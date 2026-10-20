// src/services/navigationBridge.js - Paso de datos entre módulos sin almacenamiento del navegador (H3).
// Los datos viven solo en memoria de la pestaña: no quedan en sessionStorage/localStorage y desaparecen
// al recargar o cerrar sesión.

const puentes = new Map();

export const dejarEnPuente = (clave, valor) => {
  puentes.set(clave, valor);
};

export const leerPuente = clave => (puentes.has(clave) ? puentes.get(clave) : null);

export const retirarDelPuente = clave => {
  puentes.delete(clave);
};

export const vaciarPuentes = () => {
  puentes.clear();
};
