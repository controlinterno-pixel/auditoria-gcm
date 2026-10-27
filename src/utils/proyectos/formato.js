// src/utils/proyectos/formato.js - Presentación de cifras: un dato que falta se muestra como "Sin datos", nunca como 0.

export const SIN_DATO = 'Sin datos';

export const porcentaje = valor => (valor === null || valor === undefined || !Number.isFinite(Number(valor)) ? SIN_DATO : `${Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`);
export const variacion = valor => (valor === null || valor === undefined ? SIN_DATO : `${valor > 0 ? '+' : ''}${porcentaje(valor)}`);
export const puntos = valor => (valor === null || valor === undefined ? SIN_DATO : `${valor > 0 ? '+' : ''}${Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 1 })} p. p.`);
export const moneda = (valor, codigo = 'COP') => (valor === null || valor === undefined || !Number.isFinite(Number(valor)) ? SIN_DATO
  : Number(valor).toLocaleString('es-CO', { style: 'currency', currency: codigo || 'COP', maximumFractionDigits: 0 }));
export const fecha = valor => {
  if (!valor) return '—';
  const texto = String(valor);
  const dia = texto.length >= 10 ? texto.slice(0, 10) : texto;
  const [anio, mes, d] = dia.split('-');
  return anio && mes && d ? `${d}/${mes}/${anio}` : texto;
};
export const fechaHora = valor => {
  if (!valor) return '—';
  const instante = new Date(valor);
  return Number.isNaN(instante.getTime()) ? String(valor) : instante.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};
export const nombreDeCorreo = correo => String(correo || '').split('@')[0].replace(/[._]/g, ' ') || '—';
