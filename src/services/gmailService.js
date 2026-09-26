// src/services/gmailService.js - Puente seguro hacia la API Backend
import { apiService } from './apiService';

export const enviarCorreoGmail = async (emailParams, userEmail, showNotification) => {
  try {
    await apiService.despacharCorreo({
      ...emailParams,
      remitente: userEmail
    });

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