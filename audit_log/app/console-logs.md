# Inventario de Console.logs — Pendientes de Limpiar

> Estado: Pendiente de limpieza antes de producción
> Última revisión: Febrero 2026

Los `console.log` de debug deben eliminarse del código antes de considerar la app en versión final.
Los `console.error` pueden mantenerse con criterio.

---

## src/App.jsx

| Línea | Código | Acción |
|---|---|---|
| 140 | `console.log('🔵 crearSugerencia llamada con:', texto)` | ELIMINAR |
| 150 | `console.error('❌ Error en sugerencia:', error)` | MANTENER |
| 153 | `console.log('✅ Sugerencia creada exitosamente')` | ELIMINAR |
| 199 | `console.log('🔵 borrarSugerencia llamada con ID:', sugerenciaId)` | ELIMINAR |
| 203 | `console.log('📤 Respuesta delete:', { error, data })` | ELIMINAR |
| 206 | `console.warn('⚠️ Delete ejecutado pero sin datos eliminados...')` | MANTENER (hasta fix RLS) |
| 209 | `console.log('🔍 Sugerencia existe después de delete:', checkData)` | ELIMINAR |
| 213 | `console.error('❌ Error eliminando sugerencia:', error)` | MANTENER |
| 216 | `console.log('✅ Sugerencia eliminada exitosamente')` | ELIMINAR |
| 234 | `console.log('=== INICIO IMPORTACIÓN EXCEL ===')` | ELIMINAR |
| 237 | `console.log('Hoja:', sheetName)` | ELIMINAR |
| 240 | `console.log('Total filas:', data.length)` | ELIMINAR |
| 241 | `console.log('Primera fila:', JSON.stringify(data[0]))` | ELIMINAR |
| 242 | `console.log('Columnas detectadas:', ...)` | ELIMINAR |
| 257 | `console.log('--- Fila ${i + 1} ---')` | ELIMINAR |
| 258 | `console.log('Row:', JSON.stringify(row))` | ELIMINAR |
| 265 | `console.log('Parsed:', { proyectoNombre, ingresos, hh, gastos })` | ELIMINAR |
| 269 | `console.log('⚠️ Proyecto vacío')` | ELIMINAR |
| 276 | `console.log('Buscando código:', codigoBusqueda)` | ELIMINAR |
| 284 | `console.log('Resultado búsqueda:', ...)` | ELIMINAR |
| 287 | `console.log('❌ NO encontrado:', proyectoNombre)` | ELIMINAR |
| 294 | `console.log('✓ Encontrado:', proyectoExistente.nombre)` | ELIMINAR |
| 307 | `console.error('❌ Error insert:', errorInsert)` | MANTENER |
| 310 | `console.log('✓ Oportunidad creada')` | ELIMINAR |
| 325 | `console.log('=== RESUMEN ===')` | ELIMINAR |
| 326 | `console.log('Insertados:', insertados, 'Errores:', errores)` | ELIMINAR |
| 327 | `console.log('No encontrados:', noEncontrados)` | ELIMINAR |
| 338 | `console.error('❌ Error importación:', error)` | MANTENER |
| 356 | `console.log('❌ Ingresos no válido:', ingresos)` | ELIMINAR |
| 362 | `console.log('❌ Gastos no válido:', gastos)` | ELIMINAR |
| 370 | `console.log('❌ HH no válido:', hh)` | ELIMINAR |
| 375 | `console.log('🔵 crearProyecto llamada:', ...)` | ELIMINAR |
| 387 | `console.error('❌ Error creando proyecto:', error)` | MANTENER |
| 390 | `console.log('✅ Proyecto creado:', nuevoProyecto.id)` | ELIMINAR |
| 648 | `{console.log('📱 App renderizado - User:', user?.email, 'Perfil:', perfil?.rol)}` | ELIMINAR (en JSX!) |

**Resumen App.jsx**: 7 MANTENER / 31 ELIMINAR

> ⚠️ La línea 648 está dentro del JSX (`return`), no en una función — hay que eliminarla con cuidado.

---

## src/components/VistaOportunidades.jsx

| Línea | Código | Acción |
|---|---|---|
| 41 | `console.error('Error cargando oportunidades:', error)` | MANTENER |
| 83 | `console.log('=== REGISTRANDO CAMBIO ===')` | ELIMINAR |
| 84 | `console.log('Usuario:', user?.email)` | ELIMINAR |
| 85 | `console.log('Campo:', campo)` | ELIMINAR |
| 86 | `console.log('Valor anterior:', valorAnterior)` | ELIMINAR |
| 87 | `console.log('Valor nuevo:', valorNuevo)` | ELIMINAR |
| 101 | `console.error('Error registrando cambio:', errorCambio)` | MANTENER |
| 104 | `console.log('Cambio registrado correctamente')` | ELIMINAR |
| 121 | `console.log('=== INICIO IMPORTACIÓN OPORTUNIDADES ===')` | ELIMINAR |
| 127 | `console.log('Total filas:', data.length)` | ELIMINAR |
| 128 | `console.log('Columnas:', ...)` | ELIMINAR |
| 161 | `console.log('No encontrado:', proyectoNombre)` | ELIMINAR |
| 179 | `console.error('Error insert:', errorInsert)` | MANTENER |
| 186 | `console.log('=== RESUMEN ===')` | ELIMINAR |
| 187 | `console.log('Insertados:', insertados, 'Errores:', errores)` | ELIMINAR |
| 190 | `console.log('No encontrados:', noEncontrados)` | ELIMINAR |
| 197 | `console.error('Error:', error)` | MANTENER |

**Resumen VistaOportunidades.jsx**: 4 MANTENER / 13 ELIMINAR

---

## src/components/VistaProyectosBase.jsx

| Línea | Código | Acción |
|---|---|---|
| 31 | `console.error('Error cargando proyectos:', error)` | MANTENER |
| 48 | `console.log('=== INICIO IMPORTACIÓN PROYECTOS ===')` | ELIMINAR |
| 54 | `console.log('Total filas:', data.length)` | ELIMINAR |
| 55 | `console.log('Columnas:', ...)` | ELIMINAR |
| 96 | `console.error('Error insert:', errorInsert)` | MANTENER |
| 114 | `console.log('=== RESUMEN ===')` | ELIMINAR |
| 115 | `console.log('Insertados:', insertados, 'Errores:', errores, ...)` | ELIMINAR |
| 118 | `console.log('Duplicados:', duplicados)` | ELIMINAR |
| 125 | `console.error('Error:', error)` | MANTENER |

**Resumen VistaProyectosBase.jsx**: 3 MANTENER / 6 ELIMINAR

---

## src/components/AdministracionOC.jsx

| Línea | Código | Acción |
|---|---|---|
| 38 | `console.log('=== ACTUALIZANDO SOLICITUD ===')` | ELIMINAR |
| 39 | `console.log('ID:', id)` | ELIMINAR |
| 40 | `console.log('Campo:', campo)` | ELIMINAR |
| 41 | `console.log('Valor:', valor)` | ELIMINAR |
| 49 | `console.log('Respuesta data:', data)` | ELIMINAR |
| 50 | `console.log('Respuesta error:', error)` | ELIMINAR |
| 53 | `console.error('Error actualizando solicitud:', error)` | MANTENER |
| 56 | `console.error('No se actualizó ningún registro...')` | MANTENER |
| 59 | `console.log('Actualización exitosa:', data)` | ELIMINAR |

**Resumen AdministracionOC.jsx**: 2 MANTENER / 7 ELIMINAR

---

## src/components/VistaSolicitudOC.jsx

| Línea | Código | Acción |
|---|---|---|
| 137 | `console.log('=== DEBUG: Subiendo archivos ===')` | ELIMINAR |
| 138 | `console.log('Solicitud ID:', solicitudId)` | ELIMINAR |
| 139 | `console.log('User ID:', user.id)` | ELIMINAR |
| 140 | `console.log('Total archivos:', archivos.length)` | ELIMINAR |
| 147 | `console.log('--- Subiendo archivo ${i+1}/${...} ---')` | ELIMINAR |
| 148 | `console.log('Nombre original:', archivo.name)` | ELIMINAR |
| 149 | `console.log('Path destino:', nombreArchivo)` | ELIMINAR |
| 150 | `console.log('Tamaño:', ...)` | ELIMINAR |
| 151 | `console.log('Tipo:', archivo.type)` | ELIMINAR |
| 158-164 | `console.error('❌ ERROR SUBIENDO ARCHIVO:', ...)` (bloque) | MANTENER (parcial, simplificar) |
| 168 | `console.log('✓ Archivo subido exitosamente:', data.path)` | ELIMINAR |
| 178 | `console.log('✓ Todos los archivos subidos exitosamente')` | ELIMINAR |
| 186 | `console.log('=== DEBUG: Generando URLs de descarga ===')` | ELIMINAR |
| 187 | `console.log('ID Correlativo:', solicitud.id_correlativo)` | ELIMINAR |
| 197 | `console.error('Error generando URL para:', archivo.nombre, error)` | MANTENER |
| 201 | `console.log('✓ URL generada para:', archivo.nombre)` | ELIMINAR |
| 206 | `console.log('URLs generadas:', archivosConUrls)` | ELIMINAR |
| 226 | `console.log('📧 Enviando correo via API...')` | ELIMINAR |
| 240 | `console.log('✅ Correo enviado:', result)` | ELIMINAR |
| 297-301 | `console.log('=== DEBUG: Datos a insertar ===')` (bloque) | ELIMINAR |
| 311-316 | `console.error('=== ERROR DE SUPABASE ===')` (bloque) | MANTENER (simplificar) |
| 338 | `console.error('Error:', error)` | MANTENER |

**Resumen VistaSolicitudOC.jsx**: 5 MANTENER / 18 ELIMINAR

---

## api/enviar-email-oc.js

| Línea | Código | Acción |
|---|---|---|
| 31 | `console.log('🏢 Empresa del usuario:', empresa)` | ELIMINAR |
| 42 | `console.log('⚠️ No se encontró config para', empresa, '...')` | MANTENER |
| 46 | `console.log('✓ Correos desde BD:', destinatariosConfig)` | ELIMINAR |
| 50 | `console.log('🔐 Verificando credenciales Gmail...')` | ELIMINAR |
| 51 | `console.log('GMAIL_USER configurado:', !!process.env.GMAIL_USER)` | ELIMINAR |
| 52 | `console.log('GMAIL_APP_PASSWORD configurado:', ...)` | ELIMINAR |
| 55 | `console.error('❌ Faltan credenciales de Gmail')` | MANTENER |
| 74 | `console.log('📎 Descargando', data.archivosAdjuntos.length, 'archivos...')` | ELIMINAR |
| 79 | `console.log('⬇️ Descargando:', archivo.nombre)` | ELIMINAR |
| 89 | `console.log('✓ Descargado:', archivo.nombre, '...MB')` | ELIMINAR |
| 96 | `console.error('❌ Error descargando:', archivo.nombre, error.message)` | MANTENER |
| 100 | `console.log('✓ Total adjuntos:', attachments.length)` | ELIMINAR |
| 160 | `console.log('📧 Enviando correo via Gmail...')` | ELIMINAR |
| 161 | `console.log('From:', process.env.GMAIL_USER)` | ELIMINAR |
| 162 | `console.log('To:', destinatariosUnicos)` | ELIMINAR |
| 163 | `console.log('Empresa:', empresa)` | ELIMINAR |
| 164 | `console.log('Attachments:', attachments.length)` | ELIMINAR |
| 176 | `console.log('✅ Correo enviado:', info.messageId)` | MANTENER |
| 186 | `console.error('❌ Error:', error)` | MANTENER |

**Resumen enviar-email-oc.js**: 5 MANTENER / 14 ELIMINAR

---

## Resumen Total

| Archivo | MANTENER | ELIMINAR | Total |
|---|---|---|---|
| src/App.jsx | 7 | 31 | 38 |
| VistaOportunidades.jsx | 4 | 13 | 17 |
| VistaProyectosBase.jsx | 3 | 6 | 9 |
| AdministracionOC.jsx | 2 | 7 | 9 |
| VistaSolicitudOC.jsx | 5 | 18 | 23 |
| enviar-email-oc.js | 5 | 14 | 19 |
| **TOTAL** | **26** | **89** | **115** |

> Hay **89 console.logs** de debug que deben eliminarse del código antes de producción.
