// src/services/gmailService.js - Puente seguro hacia la API Backend
export const enviarCorreoGmail = async (emailParams, userEmail, showNotification) => {
  try {
    const response = await fetch('/api/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 🔒 Envía la cookie de sesión del servidor
      body: JSON.stringify({
        ...emailParams,
        remitente: userEmail
      }),
    });

    if (!response.ok) {
      throw new Error('El servidor rechazó el despacho del correo');
    }

    if (showNotification) {
      showNotification("Notificación enviada exitosamente a través del servidor.", "success");
    }
    return true;
  } catch (error) {
    console.error("❌ Error enviando correo vía backend:", error);
    if (showNotification) {
      showNotification("No se pudo enviar el correo de notificación.", "error");
    }
    return false;
  }
};