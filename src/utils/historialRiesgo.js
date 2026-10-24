// 🕑 Historial de cambios de riesgos y controles: qué campo cambió, valor anterior y nuevo.
// Lo calcula el servidor al guardar comparando la versión guardada con la nueva (no depende del navegador).
import { codigoControl } from './explicacionControles.js';

const CAMPOS_RIESGO = [
  ['descripcion', 'Descripción del riesgo'],
  ['causaInmediata', 'Causa inmediata'],
  ['causaRaiz', 'Causa raíz'],
  ['afectacion', 'Afectación'],
  ['clasificacionRiesgo', 'Clasificación'],
  ['categoria', 'Categoría'],
  ['normativa', 'Normativa'],
  ['macroprocesos', 'Macroprocesos'],
  ['subprocesos', 'Subprocesos'],
  ['responsable', 'Responsable'],
  ['probabilidadInherente', 'Probabilidad inherente'],
  ['impactoInherente', 'Impacto inherente'],
  ['probabilidadResidual', 'Probabilidad residual'],
  ['impactoResidual', 'Impacto residual'],
  ['tratamiento', 'Estrategia de tratamiento'],
  ['planAccionRiesgo', 'Plan de acción'],
  ['fechaSeguimiento', 'Fecha de seguimiento'],
  ['seguimientoBitacora', 'Bitácora de seguimiento'],
];
const CAMPOS_CONTROL = [
  ['descripcion', 'Descripción'],
  ['tipo', 'Tipo'],
  ['implementacion', 'Ejecución'],
  ['documentacion', 'Documentación'],
  ['frecuencia', 'Frecuencia'],
  ['evidencia', 'Evidencia'],
];
const PORCENTAJES = new Set(['probabilidadInherente', 'impactoInherente', 'probabilidadResidual', 'impactoResidual']);
const LARGO_MAXIMO = 300;

const comoTexto = (valor, campo) => {
  if (valor === undefined || valor === null || valor === '') return '';
  if (Array.isArray(valor)) return valor.map(item => String(item ?? '').trim()).filter(Boolean).join(', ');
  const texto = String(valor).trim();
  return PORCENTAJES.has(campo) && texto !== '' ? `${texto}%` : texto;
};
const recortar = texto => (texto.length > LARGO_MAXIMO ? `${texto.slice(0, LARGO_MAXIMO)}…` : texto);

/** Lista de cambios { campo, antes, despues } entre dos versiones de un riesgo (incluye sus controles). */
export function compararRiesgos(anterior = {}, nuevo = {}) {
  const cambios = [];
  CAMPOS_RIESGO.forEach(([campo, etiqueta]) => {
    if (!Object.hasOwn(nuevo, campo)) return;
    const antes = comoTexto(anterior[campo], campo);
    const despues = comoTexto(nuevo[campo], campo);
    if (antes !== despues) cambios.push({ campo: etiqueta, antes: recortar(antes), despues: recortar(despues) });
  });

  // Controles por posición (código CTL-{riesgo}-{n}). Anular/reactivar tiene su propia entrada con el motivo.
  const idRiesgo = nuevo.id ?? anterior.id;
  if (Array.isArray(nuevo.controlesDetallados)) {
    const antes = Array.isArray(anterior.controlesDetallados) ? anterior.controlesDetallados : [];
    const despues = nuevo.controlesDetallados;
    despues.forEach((control, indice) => {
      const codigo = codigoControl(indice, idRiesgo);
      const previo = antes[indice];
      if (!previo) {
        cambios.push({ campo: `${codigo} agregado`, antes: '', despues: recortar(comoTexto(control?.descripcion)) });
        return;
      }
      CAMPOS_CONTROL.forEach(([campo, etiqueta]) => {
        const valorAntes = comoTexto(previo?.[campo]);
        const valorDespues = comoTexto(control?.[campo]);
        if (valorAntes !== valorDespues) cambios.push({ campo: `${codigo} · ${etiqueta}`, antes: recortar(valorAntes), despues: recortar(valorDespues) });
      });
    });
    antes.slice(despues.length).forEach((control, desplazamiento) => {
      cambios.push({ campo: `${codigoControl(despues.length + desplazamiento, idRiesgo)} eliminado`, antes: recortar(comoTexto(control?.descripcion)), despues: '' });
    });
  }
  return cambios;
}

/** Entrada de historial con el detalle de los cambios, o null si no cambió nada. */
export function entradaDeCambios({ usuario, cambios, ahora = new Date() }) {
  if (!cambios.length) return null;
  const nombres = [...new Set(cambios.map(cambio => cambio.campo))];
  return {
    fecha: ahora.toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    timestamp: ahora.toISOString(),
    usuario,
    accion: `Modificó ${nombres.length <= 4 ? nombres.join(', ') : `${nombres.slice(0, 4).join(', ')} y ${nombres.length - 4} campos más`}`,
    cambios,
  };
}
