// src/utils/avisoAccesoUsuario.js - Correo al solicitante cuando el administrador aprueba o rechaza su acceso.
// Se envía igual que las notificaciones de planes: desde el Gmail del administrador (enviarCorreoGmail).

const NOMBRES_ROL = { admin: 'Administrador', auditor: 'Auditor', lider: 'Líder de proceso' };

/** Parámetros para enviarCorreoGmail con los datos reales de la solicitud resuelta. */
export function correoAccesoResuelto(usuario, respuesta, enlace) {
  const nombre = String(usuario?.nombreResponsable || usuario?.nombre || '').trim();
  const saludo = nombre ? `Hola, ${nombre}:` : 'Hola:';
  const destinatarios = String(usuario?.correo || usuario?.email || '').trim();

  if (respuesta?.estadoAcceso === 'rechazado') {
    return {
      ref_consecutivo: 'ACCESO',
      titulo_informe: 'Solicitud de acceso rechazada',
      proceso_auditado: `${saludo} tu solicitud de acceso al aplicativo GCM fue rechazada. Si crees que es un error, comunícate con Control Interno.`,
      destinatarios,
    };
  }

  const procesos = respuesta?.procesosAsignados || [];
  const subprocesos = respuesta?.subprocesosAsignados || [];
  const alcance = [
    NOMBRES_ROL[usuario?.rol] ? `Rol: ${NOMBRES_ROL[usuario.rol]}.` : '',
    procesos.length ? `Macroprocesos: ${procesos.join(', ')}.` : '',
    procesos.length ? `Subprocesos: ${subprocesos.length ? subprocesos.join(', ') : 'todos los de esos macroprocesos'}.` : '',
  ].filter(Boolean).join(' ');
  return {
    ref_consecutivo: 'ACCESO',
    titulo_informe: 'Tu acceso al aplicativo GCM fue aprobado',
    proceso_auditado: `${saludo} ya puedes ingresar con tu correo y contraseña.${alcance ? ` ${alcance}` : ''}`,
    enlace_pdf: enlace,
    destinatarios,
  };
}
