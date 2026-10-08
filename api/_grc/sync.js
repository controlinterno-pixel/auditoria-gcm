// api/grc/sync.js - Sincronización GRC con Row-Level Security Optimizada
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { guardarWorkspaceParcial, leerWorkspaceGrc } from '../_lib/grcWorkspace.js';

/**
 * Valida de forma estricta si el usuario posee rol administrativo o de auditoría.
 */
function esRolAdministrador(rol) {
  if (!rol || typeof rol !== 'string') return false;
  const normalizado = rol.toLowerCase().trim();
  return normalizado === 'admin' || normalizado === 'administrador' || normalizado === 'auditor';
}

function normalizarProceso(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Motor ABAC / RLS Avanzado: Filtra colecciones garantizando que el usuario solo vea
 * lo que le corresponde por Correo, Cargo o Proceso.
 */
function aplicarRLS(lista = [], userEmail, userCargo, userProcess) {
  if (!Array.isArray(lista)) return [];

  const emailSafe = String(userEmail || '').toLowerCase().trim();
  const cargoSafe = String(userCargo || '').toLowerCase().trim();
  const processSafe = String(userProcess || '').toLowerCase().trim();

  return lista.filter(item => {
    if (!item || typeof item !== 'object') return false;

    // =========================================================
    // REGLA 1: Identidad (Correo Electrónico)
    // Si mi correo está en algún campo clave de este registro, lo veo.
    // =========================================================
    if (emailSafe) {
      const correosInvolucrados = [
        item.correoResponsable, item.correo_responsable,
        item.correoAuditor, item.correo_auditor, item.correoAuditorResponsable,
        item.correoRevisor, item.correo_revisor,
        item.correoEnviadoA, item.correoCreador
      ].join(' ').toLowerCase();

      if (correosInvolucrados.includes(emailSafe)) return true;
    }

    // =========================================================
    // REGLA 2: Estructural (Proceso / Subproceso)
    // Si yo pertenezco a este proceso, veo todo lo que sucede aquí.
    // =========================================================
    if (processSafe) {
      const procesoRegistro = String(item.proceso || item.macroproceso || '').toLowerCase();
      const subprocesoRegistro = String(item.subproceso || '').toLowerCase();
      
      if (procesoRegistro && (
        procesoRegistro.includes(processSafe) ||
        subprocesoRegistro.includes(processSafe) ||
        processSafe.includes(procesoRegistro)
      )) {
        return true;
      }
    }

    // =========================================================
    // REGLA 3: Operativo (Cargo Múltiple)
    // Si mi cargo fue asignado a este registro (como responsable, revisor, etc.), lo veo.
    // =========================================================
    if (cargoSafe) {
      const rolesInvolucrados = [
        item.responsable,
        item.auditor, item.auditorResponsable, item.auditorAsignado,
        item.revisor,
        item.elaboradoPor, item.revisadoPor, item.aprobadoPor,
        item.participantes, item.socializadoCon
      ].join(' ').toLowerCase();

      // Buscamos si el cargo del usuario está contenido en la cadena de roles asignados
      if (rolesInvolucrados.includes(cargoSafe)) return true;
    }

    // Si no cumplió NINGUNA de las reglas de seguridad corporativa, se oculta el registro
    return false;
  });
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendError(res, 'Método no permitido.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const isAdmin = esRolAdministrador(user.rol);

    // =========================================================================
    // 🛡️ LÓGICA GET: LECTURA CON ROW-LEVEL SECURITY (RLS) SERVER-SIDE
    // =========================================================================
    if (req.method === 'GET') {
      const { data } = await leerWorkspaceGrc();

      // Administradores y Auditores acceden a la totalidad de la base de datos
      if (isAdmin) {
        return sendSuccess(res, data);
      }

      // Extracción segura del contexto del usuario autenticado
      const userEmail = String(user.email || '').toLowerCase().trim();
      const userCargo = String(user.cargo || user.rol || '').toLowerCase().trim();
      const userProcess = String(user.procesoAsignado || user.proceso || user.area || '').toLowerCase().trim();
      const procesoUsuarioNormalizado = normalizarProceso(userProcess);
      const catalogoCargosSeguro = (Array.isArray(data.catalogoCargos) ? data.catalogoCargos : []).map(registro => {
        if (isAdmin) return registro;
        const procesoCargo = normalizarProceso(registro?.macroproceso);
        return procesoCargo && procesoCargo === procesoUsuarioNormalizado
          ? registro
          : { ...registro, correoCorporativo: '' };
      });

      // ============================================================================
      // 🛡️ HERENCIA DE PERMISOS RLS RELACIONAL (Bottom-Up)
      // Si el usuario tiene acceso a un Plan, DEBE tener acceso a su Hallazgo e Informe Padre
      // ============================================================================
      
      // 1. Filtramos los Planes de Acción (Nivel más bajo)
      const planesPermitidos = aplicarRLS(data.planes, userEmail, userCargo, userProcess);
      const idsHallazgosDesdePlanes = new Set(planesPermitidos.map(p => String(p.idHallazgo)));

      // 2. Filtramos Hallazgos (Pasan si cumplen RLS directo O si tienen un Plan permitido)
      const hallazgosPermitidos = (data.hallazgos || []).filter(h => {
        if (idsHallazgosDesdePlanes.has(String(h.id))) return true; // Herencia del Plan
        return aplicarRLS([h], userEmail, userCargo, userProcess).length > 0; // Acceso Directo
      });
      const idsInformesDesdeHallazgos = new Set(hallazgosPermitidos.map(h => String(h.idInforme)));

      // 3. Filtramos Informes (Pasan si cumplen RLS directo O si tienen un Hallazgo permitido)
      const informesPermitidos = (data.informesAuditoria || []).filter(inf => {
        if (idsInformesDesdeHallazgos.has(String(inf.id))) return true; // Herencia del Hallazgo
        return aplicarRLS([inf], userEmail, userCargo, userProcess).length > 0; // Acceso Directo
      });

      // ============================================================================
      // EMPAQUETADO FINAL SEGURO
      // ============================================================================
      const filteredData = {
        ...data,
        catalogoCargos: catalogoCargosSeguro,
        
        // Colecciones con Herencia Relacional
        informesAuditoria: informesPermitidos,
        hallazgos: hallazgosPermitidos,
        planes: planesPermitidos,
        
        // Colecciones con RLS Estándar
        riesgos: aplicarRLS(data.riesgos, userEmail, userCargo, userProcess),
        evaluaciones: aplicarRLS(data.evaluaciones, userEmail, userCargo, userProcess),
        incidentes: aplicarRLS(data.incidentes, userEmail, userCargo, userProcess),
        
        // Colecciones Públicas o de Configuración
        fuentesMejora: data.fuentesMejora || [],
        programas: data.programas || [],
        cronograma: data.cronograma || [],
        comites: data.comites || [],
        monitoreo: data.monitoreo || []
      };

      logger.info('Datos entregados con políticas RLS RELACIONAL aplicadas.', { usuario: userEmail });
      return sendSuccess(res, filteredData);
    }

    // =========================================================================
    // 🛡️ LÓGICA POST: ESCRITURA ESTRICTA
    // =========================================================================
    if (req.method === 'POST') {
      if (!isAdmin) {
        logger.warn('Intento de escritura RLS denegado', { usuario: user.email, rol: user.rol });
        return sendError(res, 'Permisos insuficientes. Solo administradores pueden modificar la estructura GRC.', 403);
      }

      const { partialData } = req.body || {};

      if (!partialData || typeof partialData !== 'object' || Array.isArray(partialData)) {
        return sendError(res, 'Estructura de datos (partialData) inválida o ausente.', 400);
      }

      await guardarWorkspaceParcial(partialData);
      logger.info('Estructura GRC actualizada por administrador', { usuario: user.email });
      return sendSuccess(res, { message: 'Guardado exitoso.' });
    }

  } catch (error) {
    logger.error('Error interno en sync.js', error, { endpoint: req.url });
    return sendError(res, 'Error interno al procesar la base de datos.', 500);
  }
}