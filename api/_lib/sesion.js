// api/_lib/sesion.js - Atributos de la cookie de sesión (grc_session), compartidos por login y logout.

// 8 horas: una jornada. Mientras el usuario trabaja, la app renueva la cookie sin pedirle nada.
export const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

const esLocal = req => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers?.host || ''));

/**
 * La app y la API comparten dominio, así que la cookie viaja con SameSite=Strict: ningún otro sitio
 * puede hacer que el navegador la envíe (protección contra CSRF). Secure siempre, salvo en localhost.
 */
export function opcionesCookieSesion(req, maxAgeSegundos) {
  return {
    maxAge: maxAgeSegundos,
    httpOnly: true, // 🔒 Inaccesible para scripts del cliente (Anti-XSS)
    secure: !esLocal(req),
    sameSite: 'strict',
    path: '/',
  };
}
