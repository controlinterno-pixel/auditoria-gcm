// api/notifications/email.js - Despacho Real de Correos vía SMTP
import nodemailer from 'nodemailer';
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Método no permitido. Usa POST.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { ref_consecutivo, destinatarios, asunto, titulo, evidenciaUrl, appName } = req.body || {};

    if (!destinatarios || (typeof destinatarios !== 'string' && !Array.isArray(destinatarios))) {
      return sendError(res, 'Faltan destinatarios válidos para el envío de la notificación.', 400);
    }

    const listaDestinatarios = Array.isArray(destinatarios) ? destinatarios.join(', ') : destinatarios;

    // ⚡ Configuración del servidor de correo (Lee variables de entorno de Vercel)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false', // true para puerto 465
      auth: {
        user: process.env.SMTP_USER, // Ej: auditoria@termalessantarosa.com.co o cuenta Gmail
        pass: process.env.SMTP_PASS  // Contraseña de aplicación
      }
    });

    const mailOptions = {
      from: `"Sistema GRC Termales" <${process.env.SMTP_USER || 'no-reply@termales.com.co'}>`,
      to: listaDestinatarios,
      subject: asunto || `[GRC Termales] Notificación Dictamen de Auditoría ${ref_consecutivo || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
          <div style="background-color: #0A3B32; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 18px; font-weight: bold;">TERMALES SANTA ROSA DE CABAL</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">Sistema de Gestión Integral & Control Interno</p>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 14px; margin-top: 0;">Estimado(a) Líder / Responsable,</p>
            <p style="font-size: 13px; line-height: 1.5;">Se ha emitido y radicado formalmente un nuevo dictamen de auditoría en la plataforma GRC:</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #0A3B32; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 4px 0; font-size: 12px;"><b>Consecutivo:</b> ${ref_consecutivo || 'INF-2026'}</p>
              <p style="margin: 4px 0; font-size: 12px;"><b>Título:</b> ${titulo || 'Informe de Auditoría'}</p>
              <p style="margin: 4px 0; font-size: 12px;"><b>Generado por:</b> ${user.email}</p>
            </div>

            ${evidenciaUrl ? `
              <div style="text-align: center; margin: 25px 0;">
                <a href="${evidenciaUrl}" target="_blank" style="background-color: #0055ff; color: white; padding: 12px 24px; text-decoration: none; font-size: 12px; font-weight: bold; border-radius: 8px; display: inline-block;">📄 Abrir Documento Adjunto</a>
              </div>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 10px; color: #94a3b8; text-align: center; margin: 0;">Este es un mensaje automático de notificación institucional emitido por la plataforma GRC de Termales Santa Rosa de Cabal.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info('Notificación enviada exitosamente por correo real', {
      usuario: user.email,
      ref_consecutivo: ref_consecutivo || 'N/A',
      destinatarios: listaDestinatarios,
      messageId: info.messageId
    });

    return sendSuccess(res, {
      message: 'Correo electrónico despachado y entregado exitosamente al servidor de destino.',
      messageId: info.messageId
    });

  } catch (error) {
    logger.error('Error al despachar correo electrónico real', error, { endpoint: req.url });
    return sendError(res, `Falla al entregar el correo: ${error.message}`, 500);
  }
}