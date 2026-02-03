import nodemailer from 'nodemailer';

// Destinatarios fijos
const DESTINATARIOS_OC = ['fabiola.gonzalez@fch.cl', 'emilio.lopez@fch.cl'];

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
    const data = req.body;

    // Verificar credenciales
    console.log('🔐 Verificando credenciales Gmail...');
    console.log('GMAIL_USER configurado:', !!process.env.GMAIL_USER);
    console.log('GMAIL_APP_PASSWORD configurado:', !!process.env.GMAIL_APP_PASSWORD);

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('❌ Faltan credenciales de Gmail');
      return res.status(500).json({
        error: 'Credenciales de Gmail no configuradas en el servidor'
      });
    }

    // Configurar transporter de Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Descargar archivos desde Supabase Storage
    const attachments = [];

    if (data.archivosAdjuntos && data.archivosAdjuntos.length > 0) {
      console.log('📎 Descargando', data.archivosAdjuntos.length, 'archivos...');

      for (const archivo of data.archivosAdjuntos) {
        if (archivo.url) {
          try {
            console.log('⬇️ Descargando:', archivo.nombre);
            const response = await fetch(archivo.url);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            console.log('✓ Descargado:', archivo.nombre, '-', (buffer.length / 1024 / 1024).toFixed(2), 'MB');

            attachments.push({
              filename: archivo.nombre,
              content: buffer
            });
          } catch (error) {
            console.error('❌ Error descargando:', archivo.nombre, error.message);
          }
        }
      }
      console.log('✓ Total adjuntos:', attachments.length);
    }

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
              <h2>🧾 Nueva Solicitud de Orden de Compra #${data.idCorrelativo}</h2>
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
            </div>
            <div class="footer">
              <p>Solicitud enviada por: <strong>${data.usuarioEmail}</strong></p>
              <p>Fecha: ${new Date().toLocaleString('es-CL')}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Combinar destinatarios (usuario + admins) y eliminar duplicados
    const todosDestinatarios = [data.usuarioEmail, ...DESTINATARIOS_OC];
    const destinatariosUnicos = [...new Set(todosDestinatarios)];

    console.log('📧 Enviando correo via Gmail...');
    console.log('From:', process.env.GMAIL_USER);
    console.log('To:', destinatariosUnicos);
    console.log('Attachments:', attachments.length);

    const mailOptions = {
      from: `DeskFlow FCH <${process.env.GMAIL_USER}>`,
      to: destinatariosUnicos.join(', '),
      subject: `Nueva Solicitud OC #${data.idCorrelativo} - ${data.proveedor} (${valorFormateado})`,
      html: htmlContent,
      attachments: attachments
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Correo enviado:', info.messageId);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      recipients: destinatariosUnicos
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
