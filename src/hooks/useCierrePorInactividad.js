// src/hooks/useCierrePorInactividad.js - Cierra la sesión cuando nadie usa la app durante un tiempo.
// 🛡️ Evita que una sesión quede abierta en un equipo compartido o desatendido. La última actividad se
// guarda en localStorage para que todas las pestañas compartan el mismo reloj, y al abrir la app se
// comprueba: si el navegador quedó cerrado más que el límite, la sesión no se reanuda.
import { useCallback, useEffect, useRef, useState } from 'react';

export const MINUTOS_INACTIVIDAD = 30;
export const SEGUNDOS_AVISO = 60;
const LIMITE_MS = MINUTOS_INACTIVIDAD * 60 * 1000;
const CLAVE = 'gcm_ultima_actividad';
const ESCRIBIR_CADA_MS = 15 * 1000;
const EVENTOS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];

const leerUltimaActividad = () => {
  try {
    return Number(window.localStorage.getItem(CLAVE)) || 0;
  } catch {
    return 0;
  }
};
const guardarUltimaActividad = momento => {
  try {
    window.localStorage.setItem(CLAVE, String(momento));
  } catch {
    // Sin almacenamiento cada pestaña lleva su propio reloj; el cierre sigue funcionando.
  }
};

/** La pantalla de ingreso lo llama: un inicio de sesión nuevo no hereda la inactividad de la sesión anterior. */
export const reiniciarRelojInactividad = () => {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento no hay reloj compartido que reiniciar.
  }
};

/**
 * activo: hay una sesión iniciada. alExpirar: cierra la sesión.
 * Devuelve { segundosRestantes, seguirConectado }: segundosRestantes es null salvo en el último minuto.
 */
export function useCierrePorInactividad(activo, alExpirar) {
  const [segundosRestantes, setSegundosRestantes] = useState(null);
  const ultimaLocal = useRef(0);
  const ultimaEscritura = useRef(0);
  const expirado = useRef(false);
  const alExpirarRef = useRef(alExpirar);
  useEffect(() => { alExpirarRef.current = alExpirar; }, [alExpirar]);

  const registrarActividad = useCallback(() => {
    const ahora = Date.now();
    ultimaLocal.current = ahora;
    if (ahora - ultimaEscritura.current >= ESCRIBIR_CADA_MS) {
      ultimaEscritura.current = ahora;
      guardarUltimaActividad(ahora);
    }
  }, []);

  const seguirConectado = useCallback(() => {
    ultimaEscritura.current = 0;
    registrarActividad();
    setSegundosRestantes(null);
  }, [registrarActividad]);

  useEffect(() => {
    if (!activo) return undefined;
    expirado.current = false;

    const revisar = () => {
      if (expirado.current) return;
      const ultima = Math.max(ultimaLocal.current, leerUltimaActividad());
      const restanteMs = ultima + LIMITE_MS - Date.now();
      if (restanteMs <= 0) {
        expirado.current = true;
        setSegundosRestantes(null);
        alExpirarRef.current?.();
        return;
      }
      setSegundosRestantes(restanteMs <= SEGUNDOS_AVISO * 1000 ? Math.ceil(restanteMs / 1000) : null);
    };

    // Al abrir: si la última actividad guardada es más vieja que el límite, se cierra sin reanudar.
    const guardada = leerUltimaActividad();
    if (guardada && Date.now() - guardada > LIMITE_MS) {
      revisar();
      return undefined;
    }
    ultimaEscritura.current = 0;
    registrarActividad();

    EVENTOS.forEach(evento => window.addEventListener(evento, registrarActividad, { passive: true }));
    const intervalo = window.setInterval(revisar, 1000);
    const alVolver = () => { if (document.visibilityState === 'visible') revisar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      EVENTOS.forEach(evento => window.removeEventListener(evento, registrarActividad));
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [activo, registrarActividad]);

  return { segundosRestantes, seguirConectado };
}
