// src/utils/proyectos/catalogos.js - Interesados y participantes de los proyectos contra el catálogo de
// Cargos y Procesos: los de la empresa son cargos del catálogo y los externos, organizaciones registradas.

const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Nombre tal como está en el catálogo (sin importar tildes ni mayúsculas), o null si no está. */
export function buscarEnCatalogo(valor, lista = []) {
  const buscado = normalizar(valor);
  if (!buscado) return null;
  return lista.find(item => normalizar(item) === buscado) ?? null;
}

export const DONDE_CREAR = {
  cargo: 'Informes y Hallazgos → Cargos y Procesos → Cargos y correos',
  organizacion: 'Informes y Hallazgos → Cargos y Procesos → Organizaciones externas',
};

/**
 * Valores de los apartados 12 (interesados) y 14 (organigrama) que no están en el catálogo. Mientras el
 * catálogo no se haya inicializado no se exige nada (no habría de dónde elegir).
 */
export function faltantesEnCatalogo(seccion, datos = {}, { cargos = [], organizaciones = [], inicializado = false } = {}) {
  if (!inicializado) return [];
  const faltan = [];
  const revisar = (valor, tipo, donde) => {
    if (String(valor ?? '').trim() && !buscarEnCatalogo(valor, tipo === 'cargo' ? cargos : organizaciones)) {
      faltan.push({ valor: String(valor).trim(), tipo, donde });
    }
  };
  if (seccion === 'interesados') {
    (datos.lista || []).forEach((interesado, i) => {
      revisar(interesado.nombre, interesado.tipo === 'externo' ? 'organizacion' : 'cargo', `interesado ${i + 1}`);
      revisar(interesado.responsable, 'cargo', `responsable de la relación del interesado ${i + 1}`);
    });
  }
  if (seccion === 'organigrama') {
    (datos.roles || []).forEach((rol, i) => {
      if (rol.origen === 'externa') revisar(rol.organizacion, 'organizacion', `rol ${i + 1}`);
      else revisar(rol.persona, 'cargo', `rol ${i + 1}`);
    });
  }
  return faltan;
}

/** Mensaje que bloquea el guardado mientras falte crear algo en el catálogo. */
export function mensajeFaltantes(faltan) {
  if (!faltan.length) return '';
  const cargos = [...new Set(faltan.filter(item => item.tipo === 'cargo').map(item => `«${item.valor}»`))];
  const organizaciones = [...new Set(faltan.filter(item => item.tipo === 'organizacion').map(item => `«${item.valor}»`))];
  return [
    cargos.length ? `No están en el catálogo de cargos: ${cargos.join(', ')}. Créalos en ${DONDE_CREAR.cargo}.` : '',
    organizaciones.length ? `No están en el catálogo de organizaciones: ${organizaciones.join(', ')}. Créalas en ${DONDE_CREAR.organizacion}.` : '',
    'Luego vuelve y guarda el apartado.',
  ].filter(Boolean).join(' ');
}
