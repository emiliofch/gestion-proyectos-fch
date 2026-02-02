import { Resend } from 'resend';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const data = req.body;

    const valorFormateado = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(data.valor);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF5100; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #555; }
            .value { color: #333; margin-left: 10px; }
            .highlight { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 15px 0; }
            .footer { margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🧾 Nueva Solicitud de Orden de Compra</h2>
            </div>
            <div class="content">
              <div class="field"><span class="label">📋 Tipo:</span><span class="value">${data.tipo}</span></div>
              <div class="field"><span class="label">🏢 Proveedor:</span><span class="value">${data.proveedor}</span></div>
              <div class="field"><span class="label">🆔 RUT:</span><span class="value">${data.rut}</span></div>
              <div class="field"><span class="label">📁 Proyecto:</span><span class="value">${data.proyectoNombre}</span></div>
              ${data.subproyecto ? `<div class="field"><span class="label">📂 Subproyecto:</span><span class="value">${data.subproyecto}</span></div>` : ''}
              <div class="field"><span class="label">🏷️ CECO:</span><span class="value">${data.ceco}</span></div>
              <div class="field"><span class="label">📝 Glosa:</span><span class="value">${data.glosa}</span></div>
              <div class="highlight">
                <div class="field"><span class="label">💰 Valor:</span><span class="value" style="font-size: 18px; font-weight: bold;">${valorFormateado}</span></div>
              </div>
              ${data.detalle ? `<div class="field"><span class="label">📄 Detalle:</span><div style="margin-top: 5px; padding: 10px; background: white; border-radius: 4px;">${data.detalle}</div></div>` : ''}
              ${data.archivosAdjuntos && data.archivosAdjuntos.length > 0 ? `
              <div style="background: white; padding: 15px; border-radius: 4px; margin-top: 15px;">
                <div class="label">📎 Archivos adjuntos (${data.archivosAdjuntos.length}):</div>
                ${data.archivosAdjuntos.map((archivo, idx) => `
                  <div style="padding: 8px; margin: 5px 0; background: #e3f2fd; border-radius: 4px;">
                    ${idx + 1}. ${archivo.nombre || 'Archivo adjunto'}
                  </div>
                `).join('')}
              </div>
              ` : ''}
            </div>
            <div class="footer">
              <p>Solicitud enviada por: <strong>${data.usuarioEmail}</strong></p>
              <p>Fecha: ${new Date().toLocaleString('es-CL')}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enviar a usuario
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Sistema FCH <noreply@fch.cl>',
      to: data.usuarioEmail,
      subject: `Confirmación: Solicitud OC - ${data.proveedor} (${valorFormateado})`,
      html: htmlContent,
    });

    // Enviar a destinatarios fijos
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Sistema FCH <noreply@fch.cl>',
      to: ['fabiola.gonzalez@fch.cl', 'emilio.lopez@fch.cl'],
      subject: `Nueva Solicitud OC - ${data.proveedor} (${valorFormateado})`,
      html: htmlContent,
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
