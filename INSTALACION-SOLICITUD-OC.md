# Instalación: Sistema de Solicitud OC

Este documento proporciona instrucciones paso a paso para configurar el sistema de Solicitud de Orden de Compra (OC).

## 📋 Resumen

Se ha implementado una nueva funcionalidad que permite a los usuarios crear solicitudes de órdenes de compra con:
- Formulario completo con validaciones
- Upload de archivos adjuntos (mínimo 1 o 3 según monto)
- Envío automático de correos a usuario y destinatarios fijos
- Gestión de CECOs por proyecto
- Historial de solicitudes

## 🚀 Pasos de Instalación

### 1. Instalar Dependencia de Node.js

```bash
npm install resend
```

### 2. Configurar Base de Datos (Supabase)

**2.1. Crear Tablas**

1. Ir a Supabase Dashboard
2. Navegar a: **SQL Editor**
3. Crear nueva query
4. Copiar y ejecutar el contenido del archivo: [`setup-solicitud-oc.sql`](setup-solicitud-oc.sql)
5. Verificar que las tablas se crearon correctamente:
   - `proyectos_ceco`
   - `solicitudes_oc`

**2.2. Crear Bucket de Storage**

1. Ir a Supabase Dashboard
2. Navegar a: **Storage**
3. Click en "New bucket"
4. Configurar:
   - **Name:** `oc-adjuntos`
   - **Public:** NO (privado)
   - **File size limit:** 10 MB
   - **Allowed MIME types:** `application/pdf, image/jpeg, image/png, image/jpg, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
5. Click "Create bucket"

**2.3. Configurar Políticas de Storage**

Las políticas RLS para el bucket están incluidas en `setup-solicitud-oc.sql`. Ejecutarlas después de crear el bucket.

### 3. Configurar Resend (Envío de Correos)

**3.1. Crear cuenta en Resend**

1. Ir a [https://resend.com](https://resend.com)
2. Registrarse (plan gratuito: 100 emails/día)
3. Verificar email

**3.2. Obtener API Key**

1. En Resend Dashboard, ir a **API Keys**
2. Click en "Create API Key"
3. Copiar la clave generada (comienza con `re_`)

**3.3. Configurar Variables de Entorno**

Crear archivo `.env.local` en la raíz del proyecto:

```bash
cp .env.example .env.local
```

Editar `.env.local` y configurar:

```env
RESEND_API_KEY=re_tu_api_key_aqui
EMAIL_FROM=Sistema FCH <noreply@fch.cl>
```

### 4. Configurar Vercel (Deployment)

**4.1. Variables de Entorno en Vercel**

1. Ir a Vercel Dashboard
2. Seleccionar el proyecto
3. Navegar a: **Settings > Environment Variables**
4. Agregar las siguientes variables:
   - `RESEND_API_KEY`: Tu API key de Resend
   - `EMAIL_FROM`: Sistema FCH <noreply@fch.cl>
5. Aplicar para: Production, Preview, Development

**4.2. Redeploy (si es necesario)**

Si el proyecto ya está desplegado:
1. Ir a **Deployments**
2. Click en el último deployment
3. Click en "..." → "Redeploy"

### 5. Configurar CECOs Iniciales (Opcional)

Si tienes CECOs definidos para proyectos existentes:

1. Iniciar sesión como **admin**
2. Ir a **Configuración** (icono ⚙️)
3. Desplazarse a la sección "Gestión de CECOs"
4. Seleccionar proyecto
5. Agregar CECOs correspondientes

Si no tienes CECOs, los usuarios verán un mensaje indicando que el proyecto no tiene CECO asignado al intentar crear una solicitud.

### 6. Probar la Funcionalidad

**6.1. Crear un CECO de Prueba**

1. Login como admin
2. Ir a **Configuración**
3. En "Gestión de CECOs":
   - Seleccionar un proyecto
   - Agregar CECO: `TEST-001`
   - Descripción: `CECO de prueba`

**6.2. Crear una Solicitud OC**

1. Click en **🧾 Solicitud OC** en el menú
2. Completar el formulario:
   - Tipo: Factura
   - Proveedor: Proveedor Test
   - RUT: 12.345.678-9
   - Proyecto: (seleccionar el que tiene CECO)
   - Valor: 500000 (requiere 1 adjunto)
   - Glosa: Solicitud de prueba
   - Adjuntar 1 archivo PDF o imagen
3. Click en "Enviar Solicitud"

**6.3. Verificar Correos**

Deberías recibir 2 correos:
- Uno a tu email (usuario que envía)
- Uno a fabiola.gonzalez@fch.cl
- Uno a emilio.lopez@fch.cl

**6.4. Verificar Historial**

En la sección "Mis Solicitudes" deberías ver la solicitud creada.

## 📧 Cambiar Destinatarios de Correos

Los emails de los destinatarios fijos están configurados en:
[`/api/enviar-email-oc.js`](api/enviar-email-oc.js) (línea 95)

Para cambiar:
1. Editar el archivo
2. Modificar la línea:
```javascript
to: ['fabiola.gonzalez@fch.cl', 'emilio.lopez@fch.cl'],
```
3. Commit y push
4. Vercel redesplegará automáticamente

## 🔍 Validaciones Implementadas

### Validación de Adjuntos

- **Valor < $1,500,000:** Mínimo 1 archivo adjunto
- **Valor >= $1,500,000:** Mínimo 3 archivos adjuntos
- Máximo 10 MB por archivo
- Tipos permitidos: PDF, JPG, PNG, Excel

### Validación de Campos

- Todos los campos marcados con * son obligatorios
- Valor debe ser mayor a 0
- RUT, Proveedor, Glosa no pueden estar vacíos
- Proyecto debe tener CECO asignado

## 📂 Estructura de Archivos Creados

```
/
├── api/
│   └── enviar-email-oc.js          # Función Vercel para envío de correos
├── src/
│   └── components/
│       ├── VistaSolicitudOC.jsx    # Formulario de solicitud
│       └── GestionCecos.jsx        # Gestión de CECOs (admin)
├── setup-solicitud-oc.sql          # Script SQL para crear tablas
├── .env.example                    # Ejemplo de variables de entorno
├── .env.local                      # Variables de entorno (NO commitear)
└── INSTALACION-SOLICITUD-OC.md     # Este archivo
```

## 🔧 Troubleshooting

### Error: "El proyecto no tiene CECO asignado"

**Solución:** Asignar un CECO al proyecto desde Configuración > Gestión de CECOs

### Error al subir archivos

**Solución:**
1. Verificar que el bucket `oc-adjuntos` existe en Supabase Storage
2. Verificar que las políticas RLS están aplicadas
3. Verificar que el archivo es menor a 10 MB

### Correos no llegan

**Solución:**
1. Verificar que RESEND_API_KEY está configurada en Vercel
2. Verificar que el dominio está verificado en Resend (o usar sandbox para testing)
3. Revisar logs de Vercel: Functions > enviar-email-oc

### Error: "RESEND_API_KEY not found"

**Solución:** Configurar variables de entorno en Vercel y redeploy

## 📞 Contacto

Para soporte adicional, contactar al equipo de desarrollo.

---

## ✅ Checklist de Instalación

- [ ] npm install resend ejecutado
- [ ] Tablas creadas en Supabase (proyectos_ceco, solicitudes_oc)
- [ ] Bucket oc-adjuntos creado en Supabase Storage
- [ ] Políticas RLS aplicadas al bucket
- [ ] Cuenta de Resend creada
- [ ] API Key de Resend obtenida
- [ ] Archivo .env.local creado y configurado
- [ ] Variables de entorno configuradas en Vercel
- [ ] CECOs iniciales creados (opcional)
- [ ] Solicitud de prueba creada exitosamente
- [ ] Correos recibidos correctamente

---

**Última actualización:** Febrero 2026
