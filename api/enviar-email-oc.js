import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bisccrlqcixkaguspntw.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD

const ALLOWED_EMPRESAS = new Set(['CGV', 'HUB_MET'])
const MAX_ATTACHMENTS = 5
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const FALLBACK_CGV = ['fabiola.gonzalez@fch.cl', 'emilio.lopez@fch.cl']
const FALLBACK_HUBMET = ['emilio.lopez@fch.cl', 'milena.quintanilla@fch.cl']

const rateWindowMs = 60_000
const rateMax = 20
const requestCounter = new Map()

function isValidEmail(email) {
  if (typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function sanitizeText(value, maxLen = 500) {
  if (value === null || value === undefined) return ''
  const text = String(value).trim().slice(0, maxLen)
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeEmpresa(value) {
  const empresa = typeof value === 'string' ? value.trim() : 'CGV'
  return ALLOWED_EMPRESAS.has(empresa) ? empresa : 'CGV'
}

function getBody(req) {
  if (!req?.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

function checkRateLimit(ip) {
  const now = Date.now()
  const state = requestCounter.get(ip)
  if (!state || now - state.start > rateWindowMs) {
    requestCounter.set(ip, { start: now, count: 1 })
    return true
  }
  if (state.count >= rateMax) return false
  state.count += 1
  requestCounter.set(ip, state)
  return true
}

function isAllowedAttachmentUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false
  try {
    const target = new URL(rawUrl)
    const expected = new URL(SUPABASE_URL)
    return target.protocol === 'https:' && target.hostname === expected.hostname
  } catch {
    return false
  }
}

function validatePayload(rawData) {
  const data = rawData || {}
  const errors = []

  const empresa = normalizeEmpresa(data.empresa)
  const usuarioEmail = typeof data.usuarioEmail === 'string' ? data.usuarioEmail.trim() : ''
  const proveedor = sanitizeText(data.proveedor, 150)
  const tipo = sanitizeText(data.tipo, 80)
  const rut = sanitizeText(data.rut, 30)
  const proyectoNombre = sanitizeText(data.proyectoNombre, 180)
  const subproyecto = sanitizeText(data.subproyecto, 180)
  const ceco = sanitizeText(data.ceco, 80)
  const glosa = sanitizeText(data.glosa, 500)
  const detalle = sanitizeText(data.detalle, 2000)
  const idCorrelativo = sanitizeText(data.idCorrelativo, 40)
  const valor = Number(data.valor)

  if (!isValidEmail(usuarioEmail)) errors.push('usuarioEmail invalido')
  if (!proveedor) errors.push('proveedor requerido')
  if (!tipo) errors.push('tipo requerido')
  if (!rut) errors.push('rut requerido')
  if (!proyectoNombre) errors.push('proyectoNombre requerido')
  if (!ceco) errors.push('ceco requerido')
  if (!glosa) errors.push('glosa requerida')
  if (!idCorrelativo) errors.push('idCorrelativo requerido')
  if (!Number.isFinite(valor) || valor < 0) errors.push('valor invalido')

  let archivosAdjuntos = Array.isArray(data.archivosAdjuntos) ? data.archivosAdjuntos.slice(0, MAX_ATTACHMENTS) : []
  archivosAdjuntos = archivosAdjuntos
    .filter((a) => a && isAllowedAttachmentUrl(a.url))
    .map((a) => ({
      nombre: sanitizeText(a.nombre || 'adjunto', 120),
      url: String(a.url).trim(),
    }))

  return {
    errors,
    payload: {
      empresa,
      usuarioEmail,
      proveedor,
      tipo,
      rut,
      proyectoNombre,
      subproyecto,
      ceco,
      glosa,
      detalle,
      idCorrelativo,
      valor,
      archivosAdjuntos,
    },
  }
}

async function fetchAttachmentBuffer(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new Error('attachment too large')
    }

    return buffer
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientIp = getClientIp(req)
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('Missing required email environment variables')
    return res.status(500).json({ error: 'Server email configuration is incomplete' })
  }

  try {
    const body = getBody(req)
    const { errors, payload } = validatePayload(body)

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid request payload', details: errors })
    }

    let destinatariosConfig = []
    if (!SUPABASE_ANON_KEY) {
      console.warn('SUPABASE_ANON_KEY is not configured. Using fallback recipients.')
      destinatariosConfig = payload.empresa === 'HUB_MET' ? FALLBACK_HUBMET : FALLBACK_CGV
    } else {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      const { data: configData, error: configError } = await supabase
        .from('configuracion_emails')
        .select('correos')
        .eq('tipo', payload.empresa)
        .single()

      if (configError || !configData) {
        destinatariosConfig = payload.empresa === 'HUB_MET' ? FALLBACK_HUBMET : FALLBACK_CGV
      } else {
        destinatariosConfig = Array.isArray(configData.correos) ? configData.correos : []
      }
    }

    const emailsValidos = destinatariosConfig.filter(isValidEmail)
    const todosDestinatarios = [payload.usuarioEmail, ...emailsValidos]
    const destinatariosUnicos = [...new Set(todosDestinatarios)]

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    })

    const attachments = []
    for (const archivo of payload.archivosAdjuntos) {
      try {
        const content = await fetchAttachmentBuffer(archivo.url)
        attachments.push({ filename: archivo.nombre || 'adjunto', content })
      } catch (error) {
        console.error('Error downloading attachment', { file: archivo.nombre, reason: error?.message })
      }
    }

    const valorFormateado = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
    }).format(payload.valor)

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
              <h2>Nueva Solicitud de Orden de Compra #${payload.idCorrelativo}</h2>
              <span class="empresa-badge ${payload.empresa === 'HUB_MET' ? 'empresa-hubmet' : 'empresa-cgv'}">${payload.empresa === 'HUB_MET' ? 'HUB MET' : 'CGV'}</span>
            </div>
            <div class="content">
              <div class="field"><span class="label">Tipo:</span><span class="value">${payload.tipo}</span></div>
              <div class="field"><span class="label">Proveedor:</span><span class="value">${payload.proveedor}</span></div>
              <div class="field"><span class="label">RUT:</span><span class="value">${payload.rut}</span></div>
              <div class="field"><span class="label">Proyecto:</span><span class="value">${payload.proyectoNombre}</span></div>
              ${payload.subproyecto ? `<div class="field"><span class="label">Subproyecto:</span><span class="value">${payload.subproyecto}</span></div>` : ''}
              <div class="field"><span class="label">CECO:</span><span class="value">${payload.ceco}</span></div>
              <div class="field"><span class="label">Glosa:</span><span class="value">${payload.glosa}</span></div>
              <div class="highlight">
                <div class="field"><span class="label">Valor:</span><span class="value" style="font-size: 18px; font-weight: bold;">${valorFormateado}</span></div>
              </div>
              ${payload.detalle ? `<div class="field"><span class="label">Detalle:</span><div style="margin-top: 5px; padding: 10px; background: white; border-radius: 4px;">${payload.detalle}</div></div>` : ''}
            </div>
            <div class="footer">
              <p>Solicitud enviada por: <strong>${payload.usuarioEmail}</strong></p>
              <p>Fecha: ${new Date().toLocaleString('es-CL')}</p>
            </div>
          </div>
        </body>
      </html>
    `

    const mailOptions = {
      from: `DeskFlow ${payload.empresa === 'HUB_MET' ? 'HUB MET' : 'CGV'} <${GMAIL_USER}>`,
      to: destinatariosUnicos.join(', '),
      subject: `[${payload.empresa === 'HUB_MET' ? 'HUB MET' : 'CGV'}] Nueva Solicitud OC #${payload.idCorrelativo} - ${payload.proveedor} (${valorFormateado})`,
      html: htmlContent,
      attachments,
    }

    const info = await transporter.sendMail(mailOptions)

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      recipients: destinatariosUnicos,
      empresa: payload.empresa,
    })
  } catch (error) {
    console.error('Error sending OC email', { message: error?.message })
    return res.status(500).json({ error: 'Internal server error while sending email' })
  }
}
