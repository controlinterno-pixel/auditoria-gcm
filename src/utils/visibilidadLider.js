// src/utils/visibilidadLider.js - Informes, hallazgos y planes que el servidor entrega a un líder de proceso
// (rol "lider"). Ve completo lo de su alcance (macroprocesos y subprocesos autorizados), lo que creó y aquello
// donde fue nombrado; de los informes que ve, los demás hallazgos llegan solo como contexto (encabezado),
// para que la pantalla los muestre bloqueados.

import { crearAlcanceLider } from './alcanceMiEspacio.js';

const normalizar = valor => String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();
const idDe = valor => String(valor ?? '');

const CORREOS_PLAN = ['correoResponsable', 'correo_responsable', 'correoRevisor', 'correo_revisor', 'correoAuditor',
  'correo_auditor', 'correoAuditorResponsable', 'correoCreador', 'creadoPor'];
const CORREOS_HALLAZGO = ['correoCreador', 'creadoPor', 'correoResponsable', 'correoAuditor', 'correo_auditor', 'correoAuditorResponsable'];
// Encabezado que basta para dar contexto sin exponer el detalle de otros procesos.
const CAMPOS_CONTEXTO = ['id', 'ref', 'idInforme', 'titulo', 'claseObservacion', 'isEmergente', 'estado', 'proceso', 'macroproceso',
  'macroprocesos', 'subproceso', 'subprocesos', 'subprocesosPorMacroproceso'];

const tieneProceso = registro => Boolean(normalizar(registro?.proceso || registro?.macroproceso)
  || (Array.isArray(registro?.macroprocesos) && registro.macroprocesos.length));

export const encabezadoContexto = hallazgo => ({
  ...Object.fromEntries(CAMPOS_CONTEXTO.filter(campo => hallazgo?.[campo] !== undefined).map(campo => [campo, hallazgo[campo]])),
  soloContexto: true,
});

/** Lo que ve el líder. perfil: { email, cargo, procesosAsignados, subprocesosAsignados, ... }. */
export function visibilidadLider({ informes = [], hallazgos = [], planes = [], perfil = {}, mapaProcesos = {} } = {}) {
  const correo = normalizar(perfil.email);
  const cargo = normalizar(perfil.cargo);
  const dentro = crearAlcanceLider(perfil, mapaProcesos);
  const esSuCorreo = (registro, campos) => correo !== '' && campos.some(campo => normalizar(registro?.[campo]) === correo);
  const creadoPorEl = registro => esSuCorreo(registro, ['correoCreador', 'creadoPor']);

  const hallazgoPorId = new Map(hallazgos.map(hallazgo => [idDe(hallazgo.id), hallazgo]));
  const informeDePlan = plan => idDe(plan.idInforme || hallazgoPorId.get(idDe(plan.idHallazgo))?.idInforme);
  const informesCreados = new Set(informes.filter(creadoPorEl).map(informe => idDe(informe.id)));
  const hallazgosCreados = new Set(hallazgos.filter(creadoPorEl).map(hallazgo => idDe(hallazgo.id)));

  // Planes: los de su alcance (o el de su hallazgo si no tienen proceso), donde está nombrado o creados por él,
  // y los de un hallazgo o informe que él creó.
  const planNombrado = plan => esSuCorreo(plan, CORREOS_PLAN);
  const planesVisibles = planes.filter(plan => {
    const hallazgo = hallazgoPorId.get(idDe(plan.idHallazgo));
    return planNombrado(plan)
      || (tieneProceso(plan) ? dentro(plan) : Boolean(hallazgo) && dentro(hallazgo))
      || hallazgosCreados.has(idDe(plan.idHallazgo))
      || informesCreados.has(informeDePlan(plan));
  });
  const hallazgosConPlanNombrado = new Set(planes.filter(planNombrado).map(plan => idDe(plan.idHallazgo)));

  // Hallazgos completos: nombrado (cargo en Responsable, su correo, o en uno de sus planes), de su alcance o de un
  // informe que él creó.
  const hallazgoNombrado = hallazgo => esSuCorreo(hallazgo, CORREOS_HALLAZGO)
    || (cargo !== '' && String(hallazgo?.responsable || '').split(',').some(responsable => normalizar(responsable) === cargo))
    || hallazgosConPlanNombrado.has(idDe(hallazgo.id));
  const completos = hallazgos
    .filter(hallazgo => hallazgoNombrado(hallazgo) || dentro(hallazgo) || informesCreados.has(idDe(hallazgo.idInforme)))
    .map(hallazgo => (hallazgoNombrado(hallazgo) ? { ...hallazgo, nombradoUsuario: true } : hallazgo));
  const idsCompletos = new Set(completos.map(hallazgo => idDe(hallazgo.id)));

  // Informes: los de su alcance, los que creó y el de cada hallazgo o plan que ve.
  const idsInformes = new Set([
    ...informes.filter(informe => dentro(informe) || creadoPorEl(informe)).map(informe => idDe(informe.id)),
    ...completos.map(hallazgo => idDe(hallazgo.idInforme)),
    ...planesVisibles.map(informeDePlan),
  ].filter(Boolean));
  const contexto = hallazgos
    .filter(hallazgo => !idsCompletos.has(idDe(hallazgo.id)) && idsInformes.has(idDe(hallazgo.idInforme)))
    .map(encabezadoContexto);

  return {
    informes: informes.filter(informe => idsInformes.has(idDe(informe.id))),
    hallazgos: [...completos, ...contexto],
    planes: planesVisibles,
  };
}
