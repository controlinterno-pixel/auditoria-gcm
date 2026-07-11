export const enviarCorreoGmail = async (emailParams, userEmail, showNotification) => {
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    alert("⚠️ El SDK de Google aún está cargando. Espere un segundo e intente de nuevo.");
    return;
  }

  try {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: '310037504694-oaut36369g0d9p508time7un94tkksjk.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/gmail.send',
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          console.error("Error OAuth:", tokenResponse);
          return;
        }

        const accessToken = tokenResponse.close || tokenResponse.access_token;

        // 🆔 DICCIONARIO PARA TRADUCIR EL CORREO AL NOMBRE REAL DEL AUDITOR
        const mapaNombresAudtores = {
          "controlinterno@termales.com.co": "Yehison Pineda",
          "analista.auditoria@termales.com.co": "Angelica Hernandez",
          "analista.controlinterno@termales.com.co": "Luz Angela Chico",
          "auditoria@termales.com.co": "Rodolfo Gonzalez"
        };

        const correoActual = String(userEmail || '').toLowerCase().trim();
        const nombreAuditorIdentificado = mapaNombresAudtores[correoActual] || correoActual;

        // Estructura Sobria y Elegante
        const mensajeMime = [
          `To: ${emailParams.destinatarios}`,
          `Subject: [GCM Auditor] ${emailParams.ref_consecutivo} - ${emailParams.proceso_auditado}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          '',
          '<div style="background-color: #f8fafc; padding: 30px 15px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; min-height: 100%; width: 100%; box-sizing: border-box; text-align: center;">',
          '  <div style="max-width: 500px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 0; margin: 0 auto; text-align: left; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); overflow: hidden;">',
          '    <div style="padding: 25px 25px 20px 25px; text-align: left; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">',
          '      <table style="width: 100%; border-collapse: collapse;">',
          '        <tr>',
          '          <td style="width: 110px; vertical-align: middle; background-color: #ffffff;">',
          '            <img src="https://i.postimg.cc/hjX4w6sF/logo-termales-png.png" alt="Termales Santa Rosa" style="width: 100px; height: auto; display: block; border: 0; background-color: #ffffff;" />',
          '          </td>',
          '          <td style="padding-left: 15px; vertical-align: middle; border-left: 1px solid #e2e8f0; padding-top: 2px; padding-bottom: 2px;">',
          '            <div style="color: #0f172a; font-size: 15px; font-weight: 900; letter-spacing: 0.5px; font-family: sans-serif;">GCM AUDITOR</div>',
          '            <div style="color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: 1px; margin-top: 2px;">Gestión • Control • Mejora</div>',
          '          </td>',
          '        </tr>',
          '      </table>',
          '    </div>',
          '    <div style="padding: 30px 25px;">',
          '      <div style="text-align: center; margin-bottom: 15px;">',
          '        <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 50%; border: 1px solid #10b981; text-align: center; font-size: 18px; color: #10b981; background-color: #f0fdf4;">📄</div>',
          '      </div>',
          '      <div style="text-align: center; margin-bottom: 25px;">',
          '        <div style="font-size: 11px; font-weight: 800; color: #10b981; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">NOTIFICACIÓN OFICIAL</div>',
          `        <div style="font-size: 34px; font-weight: 800; color: #0f172a; letter-spacing: -1px; margin-bottom: 8px;">${emailParams.ref_consecutivo}</div>`,
          '        <p style="font-size: 12px; color: #64748b; margin: 0; font-weight: 500; line-height: 1.5;">Se ha registrado una actualización en la plataforma.</p>',
          '      </div>',
          '      <div style="border: 1px solid #f1f5f9; border-radius: 14px; background-color: #ffffff; padding: 4px 16px; margin-bottom: 20px;">',
          '        <table style="width: 100%; border-collapse: collapse; font-size: 12px; font-weight: 600;">',
          `          <tr style="border-bottom: 1px solid #f8fafc;"><td style="padding: 12px 0; color: #64748b; font-weight: 500;">📋 Módulo / Proceso:</td><td style="padding: 12px 0; color: #10b981; text-align: right; font-weight: 700; text-transform: capitalize;">${emailParams.proceso_auditado}</td></tr>`,
          `          <tr style="border-bottom: 1px solid #f8fafc;"><td style="padding: 12px 0; color: #64748b; font-weight: 500;">👤 Responsable Emisor:</td><td style="padding: 12px 0; color: #0f172a; text-align: right; font-weight: 700;">${nombreAuditorIdentificado}</td></tr>`,
          '        </table>',
          '      </div>',
          '      <div style="border: 1px solid #f1f5f9; border-radius: 14px; background-color: #f8fafc; padding: 16px; margin-bottom: 25px;">',
          '        <table style="width: 100%; border-collapse: collapse;">',
          '          <tr>',
          '            <td style="width: 24px; vertical-align: top; font-size: 16px; color: #10b981; padding-top: 1px;">🛡️</td>',
          '            <td style="padding-left: 10px; vertical-align: top; text-align: left;">',
          '              <div style="font-size: 9px; font-weight: 800; color: #10b981; letter-spacing: 1px; margin-bottom: 4px; text-transform: uppercase;">RESUMEN DE LA ACCIÓN</div>',
          `              <div style="font-size: 12px; color: #334155; font-weight: 600; line-height: 1.4;">${emailParams.titulo_informe}</div>`,
          '            </td>',
          '          </tr>',
          '        </table>',
          '      </div>',
          '      <div style="text-align: center; margin-bottom: 30px;">',
          `        <a href="${emailParams.enlace_pdf}" style="display: block; background-color: #00965e; color: #ffffff; font-size: 12px; font-weight: 700; text-decoration: none; padding: 14px 20px; border-radius: 12px; text-transform: uppercase; letter-spacing: 1px; text-align: center; font-family: sans-serif;">`,
          '          Ingresar a la Plataforma &nbsp; →',
          '        </a>',
          '      </div>',
          '    </div>',
          '  </div>',
          '</div>'
        ].join('\n');

        const base64Seguro = btoa(unescape(encodeURIComponent(mensajeMime)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const resGoogle = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ raw: base64Seguro })
        });

        if (resGoogle.ok) {
          if(showNotification) showNotification("🚀 Notificación enviada físicamente desde tu cuenta de Gmail institucional.");
        } else {
          alert("❌ Error: Google Workspace rechazó el despacho del correo.");
        }
      }
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });

  } catch (err) {
    console.error("Error disparando login Gmail:", err);
  }
};