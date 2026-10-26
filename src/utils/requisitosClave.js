// 🔐 Requisitos mínimos de una contraseña segura en el registro (los cuatro son obligatorios).
export const requisitosClave = (clave = '') => [
  { texto: '8 caracteres o más', cumple: clave.length >= 8 },
  { texto: 'Una letra mayúscula (A-Z)', cumple: /[A-Z]/.test(clave) },
  { texto: 'Un número (0-9)', cumple: /[0-9]/.test(clave) },
  { texto: 'Un símbolo (por ejemplo ! @ # $ %)', cumple: /[^A-Za-z0-9]/.test(clave) },
];
