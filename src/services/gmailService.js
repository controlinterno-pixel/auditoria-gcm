const GOOGLE_CLIENT_ID = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_GOOGLE_CLIENT_ID || '') : '';
const GOOGLE_OAUTH_SCOPE = 'openid email https://www.googleapis.com/auth/gmail.send';

let gmailSession = null;
let pendingAuthorization = null;

const encodeBase64 = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

const encodeBase64Url = (value) => encodeBase64(value)
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

const getRecipients = (recipients) => {
  const list = (Array.isArray(recipients) ? recipients : String(recipients || '').split(','))
    .map(email => String(email).trim())
    .filter(Boolean);

  if (!list.length || list.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('Ingresa uno o más correos destinatarios válidos, separados por comas.');
  }

  return list;
};

const loadGoogleIdentity = () => {
  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    throw new Error('No se pudo cargar la autenticación de Google. Verifica la conexión y la política CSP.');
  }

  return window.google.accounts.oauth2;
};

const verifySender = (email, expectedEmail) => {
  const expected = String(expectedEmail || '').trim().toLowerCase();
  if (expected && email.toLowerCase() !== expected) {
    throw new Error(`Autoriza en Google la misma cuenta de la sesión GRC (${expected}).`);
  }
};

const requestGmailSession = async (expectedEmail) => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Falta configurar VITE_GOOGLE_CLIENT_ID para habilitar el envío desde Gmail.');
  }

  if (gmailSession && gmailSession.expiresAt > Date.now() + 60_000) {
    const expected = String(expectedEmail || '').trim().toLowerCase();
    if (!expected || gmailSession.email.toLowerCase() === expected) return gmailSession;
    gmailSession = null;
  }

  if (!pendingAuthorization) {
    const oauth2 = loadGoogleIdentity();
    pendingAuthorization = new Promise((resolve, reject) => {
      const tokenClient = oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_OAUTH_SCOPE,
        callback: response => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error_description || response.error || 'Google no autorizó el envío.'));
            return;
          }
          resolve(response);
        },
        error_callback: error => reject(new Error(error.message || 'No se pudo abrir la ventana de Google.'))
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    }).then(async response => {
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${response.access_token}` }
      });
      const profile = await profileResponse.json().catch(() => ({}));

      if (!profileResponse.ok || !profile.email || profile.verified_email === false) {
        throw new Error(profile.error?.message || 'No se pudo verificar la cuenta autorizada de Gmail.');
      }

      const session = {
        accessToken: response.access_token,
        email: profile.email,
        expiresAt: Date.now() + (Number(response.expires_in) || 3600) * 1000
      };
      verifySender(session.email, expectedEmail);
      gmailSession = session;
      return session;
    }).finally(() => {
      pendingAuthorization = null;
    });
  }

  const session = await pendingAuthorization;
  verifySender(session.email, expectedEmail);
  return session;
};

export const prepararAutorizacionGmail = async (userEmail, showNotification) => {
  try {
    await requestGmailSession(userEmail);
    return true;
  } catch (error) {
    console.error('Error autenticando Gmail para el envío:', error);
    showNotification?.(error.message || 'No se pudo autenticar la cuenta de Gmail.', 'error');
    return false;
  }
};

const buildHtml = (emailParams, senderEmail) => {
  const reference = emailParams.ref_consecutivo || 'GRC';
  const title = emailParams.titulo || emailParams.titulo_informe || 'Notificación de Gestión GRC';
  const details = emailParams.proceso_auditado || '';
  const evidenceUrl = emailParams.evidenciaUrl || emailParams.enlace_pdf || '';
  let attachments = emailParams.anexosMultiples || [];

  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments);
    } catch {
      attachments = [];
    }
  }
  if (!Array.isArray(attachments)) attachments = [];

  const evidenceLink = (() => {
    try {
      const url = new URL(evidenceUrl);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  })();

  const attachmentLinks = attachments.map(attachment => {
    try {
      const url = new URL(attachment.url);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return `<li><a href="${escapeHtml(url.href)}">${escapeHtml(attachment.nombre || 'Anexo')}</a></li>`;
    } catch {
      return '';
    }
  }).filter(Boolean).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="background:#0A3B32;padding:20px;text-align:center;color:#fff">
        <h2 style="margin:0;font-size:18px">TERMALES SANTA ROSA DE CABAL</h2>
        <p style="margin:5px 0 0;font-size:12px">Sistema de Gestión Integral &amp; Control Interno</p>
      </div>
      <div style="padding:24px">
        <p>Se ha generado una notificación en la plataforma GRC.</p>
        <p><strong>Consecutivo:</strong> ${escapeHtml(reference)}</p>
        <p><strong>Asunto:</strong> ${escapeHtml(title)}</p>
        ${details ? `<p><strong>Detalle:</strong> ${escapeHtml(details)}</p>` : ''}
        <p><strong>Enviado por:</strong> ${escapeHtml(senderEmail)}</p>
        ${evidenceLink ? `<p><a href="${escapeHtml(evidenceLink)}">Abrir documento relacionado</a></p>` : ''}
        ${attachmentLinks ? `<p><strong>Actas y anexos:</strong></p><ul>${attachmentLinks}</ul>` : ''}
      </div>
    </div>
  `;
};

const buildRawMessage = (emailParams, senderEmail, recipients) => {
  const subject = emailParams.asunto || `[GRC Termales] Notificación ${emailParams.ref_consecutivo || ''}`;
  const encodedSubject = encodeBase64(subject);
  const encodedBody = encodeBase64(buildHtml(emailParams, senderEmail)).match(/.{1,76}/g)?.join('\r\n') || '';

  return encodeBase64Url([
    `From: ${senderEmail}`,
    `To: ${recipients.join(', ')}`,
    `Subject: =?UTF-8?B?${encodedSubject}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody
  ].join('\r\n'));
};

export const enviarCorreoGmail = async (emailParams, userEmail, showNotification) => {
  try {
    const recipients = getRecipients(emailParams.destinatarios);
    const session = await requestGmailSession(userEmail);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: buildRawMessage(emailParams, session.email, recipients) })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) gmailSession = null;
      throw new Error(result.error?.message || `Gmail rechazó el envío (HTTP ${response.status}).`);
    }

    showNotification?.(`Correo enviado desde ${session.email}.`, 'success');
    return true;
  } catch (error) {
    console.error('Error enviando correo mediante Gmail OAuth:', error);
    showNotification?.(error.message || 'No se pudo enviar el correo desde Gmail.', 'error');
    return false;
  }
};