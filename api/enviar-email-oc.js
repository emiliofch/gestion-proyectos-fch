import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Crear cliente Supabase para el API
const supabaseUrl = 'https://bisccrlqcixkaguspntw.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpc2NjcmxxY2l4a2FndXNwbnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzA5MTMsImV4cCI6MjA4NTAwNjkxM30.VU4obOq-oceRK7-rdwzDT9XB98XL_O-z7xRhxqS_H8Y';
const supabase = createClient(supabaseUrl, supabaseKey);

// Fallback si no hay config en BD
const FALLBACK_CGV = ['fabiola.gonzalez@fch.cl', 'emilio.lopez@fch.cl'];
const FALLBACK_HUBMET = ['emilio.lopez@fch.cl', 'milena.quintanilla@fch.cl'];

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
    const empresa = data.empresa || 'CGV';

    // Obtener lista de correos desde la BD
    let destinatariosConfig = [];
    const { data: configData, error: configError } = await supabase
      .from('configuracion_emails')
      .select('correos')
      .eq('tipo', empresa)
      .single();

    if (configError || !configData) {
      console.warn('⚠️ No se encontró config de correos para', empresa, '- usando fallback');
      destinatariosConfig = empresa === 'HUB_MET' ? FALLBACK_HUBMET : FALLBACK_CGV;
    } else {
      destinatariosConfig = configData.correos || [];
    }

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
      for (const archivo of data.archivosAdjuntos) {
        if (archivo.url) {
          try {
            const response = await fetch(archivo.url);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            attachments.push({
              filename: archivo.nombre,
              content: buffer
            });
          } catch (error) {
            console.error('❌ Error descargando adjunto:', archivo.nombre, error.message);
          }
        }
      }
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
            .empresa-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-left: 10px; }
            .empresa-cgv { background: #d1fae5; color: #065f46; }
            .empresa-hubmet { background: #ede9fe; color: #5b21b6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Nueva Solicitud de Orden de Compra #${data.idCorrelativo}</h2>
              <span class="empresa-badge ${empresa === 'HUB_MET' ? 'empresa-hubmet' : 'empresa-cgv'}">${empresa === 'HUB_MET' ? 'HUB MET' : 'CGV'}</span>
            </div>
            <div class="content">
              <div class="field"><span class="label">Tipo:</span><span class="value">${data.tipo}</span></div>
              <div class="field"><span class="label">Proveedor:</span><span class="value">${data.proveedor}</span></div>
              <div class="field"><span class="label">RUT:</span><span class="value">${data.rut}</span></div>
              <div class="field"><span class="label">Proyecto:</span><span class="value">${data.proyectoNombre}</span></div>
              ${data.subproyecto ? `<div class="field"><span class="label">Subproyecto:</span><span class="value">${data.subproyecto}</span></div>` : ''}
              <div class="field"><span class="label">CECO:</span><span class="value">${data.ceco}</span></div>
              <div class="field"><span class="label">Glosa:</span><span class="value">${data.glosa}</span></div>
              <div class="highlight">
                <div class="field"><span class="label">Valor:</span><span class="value" style="font-size: 18px; font-weight: bold;">${valorFormateado}</span></div>
              </div>
              ${data.detalle ? `<div class="field"><span class="label">Detalle:</span><div style="margin-top: 5px; padding: 10px; background: white; border-radius: 4px;">${data.detalle}</div></div>` : ''}
            </div>
            <div class="footer">
              <p>Solicitud enviada por: <strong>${data.usuarioEmail}</strong></p>
              <p>Fecha: ${new Date().toLocaleString('es-CL')}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Combinar destinatarios (usuario + lista configurada) y eliminar duplicados
    const todosDestinatarios = [data.usuarioEmail, ...destinatariosConfig];
    const destinatariosUnicos = [...new Set(todosDestinatarios)];

    const mailOptions = {
      from: `DeskFlow ${empresa === 'HUB_MET' ? 'HUB MET' : 'CGV'} <${process.env.GMAIL_USER}>`,
      to: destinatariosUnicos.join(', '),
      subject: `[${empresa === 'HUB_MET' ? 'HUB MET' : 'CGV'}] Nueva Solicitud OC #${data.idCorrelativo} - ${data.proveedor} (${valorFormateado})`,
      html: htmlContent,
      attachments: attachments
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Correo enviado:', info.messageId);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      recipients: destinatariosUnicos,
      empresa: empresa
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
