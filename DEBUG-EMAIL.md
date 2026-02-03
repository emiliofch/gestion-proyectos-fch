# Guía de Debug: Problema de Envío de Correos

## 🔍 Pasos para Diagnosticar

### 1. Verificar Logs en Navegador
1. Abre la aplicación en el navegador
2. Abre DevTools (F12) > pestaña **Console**
3. Envía una solicitud OC
4. Busca estos logs:
   ```
   📧 Preparando envío de correo...
   From: Sistema FCH <noreply@fch.cl>
   To: [emilio.lopez@fch.cl, fabiola.gonzalez@fch.cl, emilio.lopez@fch.cl]
   Subject: Nueva Solicitud OC #X - Proveedor...
   Attachments: X
   ```

### 2. Verificar Logs en Vercel
1. Ve a [Vercel Dashboard](https://vercel.com)
2. Selecciona el proyecto `gestion-proyectos-fch`
3. Ve a **Logs** > **Functions**
4. Busca la función `/api/enviar-email-oc`
5. Revisa los logs recientes:
   - ✅ **Success logs**: `✅ Correo enviado exitosamente`
   - ❌ **Error logs**: `Error: ...`

### 3. Verificar Resend Dashboard
1. Ve a [Resend Dashboard](https://resend.com/emails)
2. Busca el correo por:
   - **Subject**: `Nueva Solicitud OC #X`
   - **To**: tu email
3. Verifica el estado:
   - 🟢 **Delivered**: El correo fue entregado (revisar spam)
   - 🔴 **Bounced**: El correo rebotó (email inválido o bloqueado)
   - 🟡 **Queued**: En cola (esperar unos minutos)
   - ⚪ **Not Found**: No se encontró (problema de envío)

### 4. Verificar Variables de Entorno en Vercel
1. Ve a Vercel Dashboard > tu proyecto > **Settings** > **Environment Variables**
2. Verifica que existan:
   - `RESEND_API_KEY`: Tu API key de Resend
   - `EMAIL_FROM`: Sistema FCH <noreply@fch.cl> (o tu dominio verificado)

### 5. Verificar API Key de Resend
1. Ve a [Resend Dashboard](https://resend.com) > **API Keys**
2. Verifica que tu API key:
   - ✅ Existe y está activa
   - ✅ No ha expirado
   - ✅ Tiene permisos de "Email Sending"

### 6. Verificar Dominio en Resend
1. Ve a [Resend Dashboard](https://resend.com) > **Domains**
2. Opciones:
   - **Opción A (Desarrollo)**: Usa el dominio sandbox de Resend
     - Solo puedes enviar a emails verificados en Resend
     - Límite: 100 emails/día
   - **Opción B (Producción)**: Verifica tu propio dominio
     - Agrega registros DNS (SPF, DKIM, DMARC)
     - Puedes enviar a cualquier email

### 7. Problemas Comunes y Soluciones

#### ❌ Error: "API key not found"
**Solución:**
1. Ve a Vercel > Settings > Environment Variables
2. Agrega `RESEND_API_KEY` con tu API key
3. Redeploy la aplicación

#### ❌ Error: "Email address not verified"
**Solución:**
Si usas dominio sandbox de Resend:
1. Ve a [Resend Dashboard](https://resend.com) > **Emails** > **Verified Emails**
2. Agrega tu email y el de los destinatarios
3. Confirma cada email desde el correo de verificación

#### ❌ Correo llega a spam
**Solución:**
1. Marca el correo como "No es spam"
2. Agrega `noreply@fch.cl` a contactos
3. (Producción) Verifica tu dominio en Resend con registros DNS

#### ❌ Error: "Rate limit exceeded"
**Solución:**
Has alcanzado el límite de 100 emails/día del plan gratuito
1. Espera 24 horas
2. O actualiza a plan pago en Resend

### 8. Test Rápido

Ejecuta este comando para probar el envío directamente:

```bash
curl -X POST https://tu-dominio.vercel.app/api/enviar-email-oc \
  -H "Content-Type: application/json" \
  -d '{
    "idCorrelativo": 999,
    "tipo": "Factura",
    "proveedor": "Test Provider",
    "rut": "12.345.678-9",
    "proyectoNombre": "Test Project",
    "ceco": "TEST-001",
    "glosa": "Test de envío de correo",
    "valor": 100000,
    "detalle": "Este es un test",
    "archivosAdjuntos": [],
    "usuarioEmail": "tu-email@gmail.com"
  }'
```

### 9. Verificación Step-by-Step

- [ ] Logs del navegador muestran llamada a API
- [ ] Logs de Vercel muestran función ejecutándose
- [ ] Logs de Vercel muestran "✅ Correo enviado exitosamente"
- [ ] Logs de Vercel muestran "ID del correo: re_xxxxx"
- [ ] Resend Dashboard muestra el email con estado "Delivered"
- [ ] Verificar carpeta de spam en email
- [ ] Verificar que el email del destinatario sea correcto

### 10. Configuración Recomendada para Desarrollo

**Usar dominio sandbox de Resend:**
1. Ve a Resend > API Keys > Create
2. Copia la API key
3. Ve a Vercel > Settings > Environment Variables
4. Agrega `RESEND_API_KEY`
5. Agrega `EMAIL_FROM=onboarding@resend.dev` (dominio sandbox)
6. Ve a Resend > Verified Emails
7. Agrega y verifica:
   - Tu email personal
   - emilio.lopez@fch.cl
   - fabiola.gonzalez@fch.cl
8. Redeploy en Vercel

## 📊 Checklist de Verificación

```
□ API Key configurada en Vercel
□ EMAIL_FROM configurado en Vercel
□ Dominio verificado en Resend (o usando sandbox)
□ Emails de destinatarios verificados (si usas sandbox)
□ Logs de Vercel muestran ejecución exitosa
□ Resend Dashboard muestra el email
□ Estado en Resend es "Delivered"
□ Verificar carpeta de spam
```

## 🆘 Última Opción: Contacto con Soporte

Si nada funciona:
1. Captura screenshot de logs de Vercel
2. Captura screenshot de Resend Dashboard
3. Contacta soporte de Resend: support@resend.com
4. Incluye el "Email ID" de los logs
