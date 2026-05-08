import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import FilterableTh from './FilterableTh'

const MAX_ADJUNTO_MB = 5
const IMAGE_EXTENSIONS_FOR_WEBP = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'bmp',
  'gif',
  'tif',
  'tiff',
  'heic',
  'heif'
])
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['pdf', ...IMAGE_EXTENSIONS_FOR_WEBP])
const LOCAL_OC_EMAIL_API_URL = 'http://localhost:3000/api/enviar-email-oc'

function replaceFileExtension(filename, extension) {
  const lastDot = filename.lastIndexOf('.')
  const baseName = lastDot > 0 ? filename.slice(0, lastDot) : filename
  return `${baseName}.${extension}`
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const imageUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(imageUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error('image_load_failed'))
    }
    image.src = imageUrl
  })
}

async function convertImageFileToWebp(file) {
  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas_context_unavailable')

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
  if (!blob) throw new Error('webp_conversion_failed')

  return new File([blob], replaceFileExtension(file.name, 'webp'), {
    type: 'image/webp',
    lastModified: Date.now()
  })
}

export default function VistaSolicitudOC({ user, perfil }) {
  // Estados del formulario
  const [tipo, setTipo] = useState('factura')
  const [proveedor, setProveedor] = useState('')
  const [rut, setRut] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [subproyecto, setSubproyecto] = useState('')
  const [ceco, setCeco] = useState('')
  const [glosa, setGlosa] = useState('')
  const [valor, setValor] = useState('')
  const [detalle, setDetalle] = useState('')
  const [archivos, setArchivos] = useState([])

  // Estados auxiliares
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(false)
  const [solicitudes, setSolicitudes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('fecha')
  const [ordenDir, setOrdenDir] = useState('desc')
  const [pagina, setPagina] = useState(0)
  const FILAS_POR_PAGINA = 10

  const tiposDocumento = [
    { value: 'factura', label: 'Factura' },
    { value: 'factura_exenta', label: 'Factura Exenta' },
    { value: 'boleta_honorarios', label: 'Boleta de Honorarios' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'otro', label: 'Otro' }
  ]

  // Intencional: carga inicial al montar la vista.
  useEffect(() => {
    cargarProyectos()
    cargarSolicitudes()
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  useEffect(() => { setPagina(0) }, [busqueda, filtros, ordenCol, ordenDir])

  // Intencional: recalculo de CECO cuando cambia proyecto seleccionado.
  useEffect(() => {
    if (proyectoId) {
      cargarCecosProyecto(proyectoId)
    } else {
      setCeco('')
    }
  }, [proyectoId])

  async function cargarProyectos() {
    const { data } = await supabase.from('proyectos').select('*').order('nombre')
    setProyectos(data || [])
  }

  async function cargarCecosProyecto(proyectoId) {
    // Obtener el CECO directamente del proyecto
    const proyecto = proyectos.find(p => p.id === proyectoId)
    if (proyecto && proyecto.ceco) {
      setCeco(proyecto.ceco)
    } else {
      setCeco('')
    }
  }

  async function cargarSolicitudes() {
    const empresaUsuario = perfil?.empresa || 'CGV'
    const { data } = await supabase
      .from('solicitudes_oc')
      .select('*, proyectos(nombre)')
      .eq('usuario_id', user.id)
      .eq('empresa', empresaUsuario)
      .order('fecha_creacion', { ascending: false })

    setSolicitudes(data || [])
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files)
    const maxSize = MAX_ADJUNTO_MB * 1024 * 1024
    const archivosValidos = []

    for (const file of files) {
      const extension = (file.name.split('.').pop() || '').toLowerCase()
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
        toast.error(`${file.name} tiene un formato no permitido.`)
        continue
      }

      let processedFile = file
      if (IMAGE_EXTENSIONS_FOR_WEBP.has(extension)) {
        try {
          processedFile = await convertImageFileToWebp(file)
        } catch {
          toast.error(`${file.name} no pudo convertirse a WEBP. Intenta con JPG, PNG o WEBP.`)
          continue
        }
      }

      if (processedFile.size > maxSize) {
        toast.error(`${processedFile.name} excede el tamaño máximo de ${MAX_ADJUNTO_MB}MB`)
        continue
      }

      archivosValidos.push(processedFile)
    }

    setArchivos(archivosValidos)
  }

  function validarFormulario() {
    if (!tipo) {
      toast.warning('Seleccione un tipo de documento')
      return false
    }

    if (!proveedor.trim()) {
      toast.warning('Ingrese el nombre del proveedor')
      return false
    }

    if (!rut.trim()) {
      toast.warning('Ingrese el RUT del proveedor')
      return false
    }

    if (!proyectoId) {
      toast.warning('Seleccione un proyecto')
      return false
    }

    if (!ceco) {
      toast.warning('El proyecto seleccionado no tiene CECO asignado')
      return false
    }

    if (!glosa.trim()) {
      toast.warning('Ingrese una glosa')
      return false
    }

    const valorNum = parseFloat(valor)
    if (!valor || isNaN(valorNum) || valorNum <= 0) {
      toast.warning('Ingrese un valor válido mayor a 0')
      return false
    }

    const adjuntosRequeridos = valorNum >= 1500000 ? 3 : 1
    if (archivos.length < adjuntosRequeridos) {
      toast.warning(
        `Para valores ${valorNum >= 1500000 ? 'mayores o iguales a $1,500,000' : 'menores a $1,500,000'} se requieren al menos ${adjuntosRequeridos} archivo(s) adjunto(s). Actualmente tiene ${archivos.length}.`
      )
      return false
    }

    return true
  }

  async function subirArchivos(solicitudId) {
    const archivosSubidos = []

    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i]
      const extension = archivo.name.split('.').pop()
      const nombreArchivo = `${user.id}/${solicitudId}/${Date.now()}_${i}.${extension}`

      const { data, error } = await supabase.storage
        .from('oc-adjuntos')
        .upload(nombreArchivo, archivo)

      if (error) {
        console.error('Error subiendo archivo:', archivo.name, error.message)
        throw new Error(`Error al subir ${archivo.name}: ${error.message}`)
      }

      archivosSubidos.push({
        nombre: archivo.name,
        path: data.path,
        size: archivo.size,
        type: archivo.type
      })
    }

    return archivosSubidos
  }

  async function enviarCorreos(solicitud, archivosInfo) {
    const proyecto = proyectos.find(p => p.id === proyectoId)

    // Generar URLs firmadas para cada archivo (válidas por 7 días)
    const archivosConUrls = await Promise.all(
      archivosInfo.map(async (archivo) => {
        const { data, error } = await supabase.storage
          .from('oc-adjuntos')
          .createSignedUrl(archivo.path, 604800) // 7 días en segundos

        if (error) {
          console.error('Error generando URL para:', archivo.nombre, error)
          return { ...archivo, url: null }
        }

        return { ...archivo, url: data.signedUrl }
      })
    )

    // Enviar via API (Nodemailer/Gmail)
    const payload = {
      idCorrelativo: solicitud.id_correlativo,
      tipo: tiposDocumento.find(t => t.value === tipo)?.label || tipo,
      proveedor,
      rut,
      proyectoNombre: proyecto?.nombre || 'Sin proyecto',
      subproyecto,
      ceco,
      glosa,
      valor: parseFloat(valor),
      detalle,
      archivosAdjuntos: archivosConUrls,
      usuarioEmail: user.email,
      empresa: perfil?.empresa || 'CGV'
    }

    const currentHost = typeof window !== 'undefined' ? window.location.hostname : ''
    const isLocalHost = currentHost === 'localhost' || currentHost === '127.0.0.1'
    const emailApiUrl =
      import.meta.env.VITE_OC_EMAIL_API_URL ||
      (isLocalHost ? LOCAL_OC_EMAIL_API_URL : '/api/enviar-email-oc')
    const response = await fetch(emailApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    let raw = ''
    let parsed = null
    if (typeof response.text === 'function') {
      raw = await response.text()
      if (raw) {
        try {
          parsed = JSON.parse(raw)
        } catch {
          parsed = null
        }
      }
    } else if (typeof response.json === 'function') {
      try {
        parsed = await response.json()
      } catch {
        parsed = null
      }
    }

    if (!response.ok) {
      if (
        response.status === 404 &&
        (emailApiUrl === '/api/enviar-email-oc' || emailApiUrl === LOCAL_OC_EMAIL_API_URL)
      ) {
        throw new Error(
          'Endpoint de email OC no disponible. En local (5173/5174) ejecuta "vercel dev" en 3000 o configura VITE_OC_EMAIL_API_URL en .env.local'
        )
      }
      const mensaje =
        parsed?.error ||
        parsed?.message ||
        (raw ? raw.slice(0, 200) : '') ||
        `Error HTTP ${response.status}`
      throw new Error(mensaje)
    }

    return parsed || { success: true }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!validarFormulario()) return

    setLoading(true)

    try {
      const proyecto = proyectos.find(p => p.id === proyectoId)
      const empresaUsuario = perfil?.empresa || 'CGV'

      // Obtener el siguiente ID correlativo para esta empresa
      const secuencia = empresaUsuario === 'HUB_MET'
        ? 'solicitudes_oc_correlativo_hubmet_seq'
        : 'solicitudes_oc_correlativo_cgv_seq'

      const { data: seqData, error: seqError } = await supabase
        .rpc('nextval_seq', { seq_name: secuencia })

      let idCorrelativo = 1
      if (!seqError && seqData) {
        idCorrelativo = seqData
      } else {
        // Fallback: obtener el máximo + 1
        const { data: maxData } = await supabase
          .from('solicitudes_oc')
          .select('id_correlativo')
          .eq('empresa', empresaUsuario)
          .order('id_correlativo', { ascending: false })
          .limit(1)

        idCorrelativo = (maxData?.[0]?.id_correlativo || 0) + 1
      }

      const datosParaInsertar = {
        tipo,
        proveedor,
        rut,
        proyecto_id: proyectoId,
        proyecto_nombre: proyecto?.nombre,
        subproyecto: subproyecto || null,
        ceco,
        glosa,
        valor: parseFloat(valor),
        detalle: detalle || null,
        archivos_adjuntos: [],
        usuario_id: user.id,
        usuario_email: user.email,
        empresa: empresaUsuario,
        id_correlativo: idCorrelativo
      }

      // 1. Crear solicitud en BD
      const { data: solicitud, error: errorSolicitud } = await supabase
        .from('solicitudes_oc')
        .insert(datosParaInsertar)
        .select()
        .single()

      if (errorSolicitud) {
        console.error('Error creando solicitud OC:', errorSolicitud.message)
        throw errorSolicitud
      }

      // 2. Subir archivos
      const archivosInfo = await subirArchivos(solicitud.id)

      // 3. Actualizar solicitud con info de archivos
      await supabase
        .from('solicitudes_oc')
        .update({ archivos_adjuntos: archivosInfo })
        .eq('id', solicitud.id)

      // 4. Enviar correos
      await enviarCorreos(solicitud, archivosInfo)

      // 5. Limpiar formulario
      toast.success('Solicitud de OC enviada exitosamente. Revise su correo.')
      limpiarFormulario()
      cargarSolicitudes()

    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al procesar la solicitud: ' + error.message)
    }

    setLoading(false)
  }

  function limpiarFormulario() {
    setTipo('factura')
    setProveedor('')
    setRut('')
    setProyectoId('')
    setSubproyecto('')
    setCeco('')
    setGlosa('')
    setValor('')
    setDetalle('')
    setArchivos([])
    document.getElementById('file-input').value = ''
  }

  function formatearValor(val) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(val)
  }

  const adjuntosRequeridos = valor && parseFloat(valor) >= 1500000 ? 3 : 1

  function setFiltro(col, v) { setFiltros(prev => ({ ...prev, [col]: v })) }
  function toggleOrden(col) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
  }

  function coincideFiltrosHist(s, omitirCol = null) {
    const q = busqueda.toLowerCase()
    const fechaStr = s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString('es-CL') : ''
    const valorStr = formatearValor(s.valor)
    const matchBusqueda = !q || [String(s.id_correlativo || ''), s.proveedor, s.glosa, s.proyecto_nombre, valorStr, fechaStr, s.estado, s.sol_netsuite].some(v => (v || '').toLowerCase().includes(q))
    const matchId = omitirCol === 'id' || !filtros.id?.length || filtros.id.includes(String(s.id_correlativo || ''))
    const matchProveedor = omitirCol === 'proveedor' || !filtros.proveedor?.length || filtros.proveedor.includes(s.proveedor)
    const matchGlosa = omitirCol === 'glosa' || !filtros.glosa?.length || filtros.glosa.includes(s.glosa)
    const matchProyecto = omitirCol === 'proyecto' || !filtros.proyecto?.length || filtros.proyecto.includes(s.proyecto_nombre)
    const matchValor = omitirCol === 'valor' || !filtros.valor?.length || filtros.valor.includes(valorStr)
    const matchFecha = omitirCol === 'fecha' || !filtros.fecha?.length || filtros.fecha.includes(fechaStr)
    const matchEstado = omitirCol === 'estado' || !filtros.estado?.length || filtros.estado.includes(s.estado)
    const matchNetsuite = omitirCol === 'netsuite' || !filtros.netsuite?.length || filtros.netsuite.includes(s.sol_netsuite)
    return matchBusqueda && matchId && matchProveedor && matchGlosa && matchProyecto && matchValor && matchFecha && matchEstado && matchNetsuite
  }

  function opcionesPorColumnaHist(col, obtenerValor) {
    const visibles = solicitudes.filter(s => coincideFiltrosHist(s, col))
    const base = visibles.map(obtenerValor).filter(Boolean)
    const seleccionadas = Array.isArray(filtros[col]) ? filtros[col] : []
    return [...new Set([...base, ...seleccionadas])].sort((a, b) => String(a).localeCompare(String(b), 'es'))
  }

  const opcionesId = opcionesPorColumnaHist('id', s => String(s.id_correlativo || '') || null)
  const opcionesProveedor = opcionesPorColumnaHist('proveedor', s => s.proveedor)
  const opcionesGlosa = opcionesPorColumnaHist('glosa', s => s.glosa)
  const opcionesProyecto = opcionesPorColumnaHist('proyecto', s => s.proyecto_nombre)
  const opcionesValor = opcionesPorColumnaHist('valor', s => formatearValor(s.valor))
  const opcionesFecha = opcionesPorColumnaHist('fecha', s => s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString('es-CL') : null)
  const opcionesEstado = opcionesPorColumnaHist('estado', s => s.estado)
  const opcionesNetsuite = opcionesPorColumnaHist('netsuite', s => s.sol_netsuite)

  const solicitudesFiltradas = solicitudes.filter(s => coincideFiltrosHist(s)).sort((a, b) => {
    let vA, vB
    switch (ordenCol) {
      case 'id': vA = Number(a.id_correlativo) || 0; vB = Number(b.id_correlativo) || 0; break
      case 'proveedor': vA = a.proveedor || ''; vB = b.proveedor || ''; break
      case 'glosa': vA = a.glosa || ''; vB = b.glosa || ''; break
      case 'proyecto': vA = a.proyecto_nombre || ''; vB = b.proyecto_nombre || ''; break
      case 'valor': vA = Number(a.valor) || 0; vB = Number(b.valor) || 0; break
      case 'fecha': vA = new Date(a.fecha_creacion).getTime() || 0; vB = new Date(b.fecha_creacion).getTime() || 0; break
      case 'estado': vA = a.estado || ''; vB = b.estado || ''; break
      case 'netsuite': vA = a.sol_netsuite || ''; vB = b.sol_netsuite || ''; break
      default: vA = new Date(a.fecha_creacion).getTime() || 0; vB = new Date(b.fecha_creacion).getTime() || 0
    }
    if (typeof vA === 'string') return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
    return ordenDir === 'asc' ? vA - vB : vB - vA
  })

  const totalValor = solicitudesFiltradas.reduce((sum, s) => sum + (parseFloat(s.valor) || 0), 0)

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: '#FF5100' }}>
        Solicitud de Orden de Compra
      </h2>

      <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Tipo */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Tipo de Documento <span className="text-red-500">*</span>
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              {tiposDocumento.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Proveedor */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Proveedor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Nombre del proveedor"
              required
            />
          </div>

          {/* RUT */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              RUT <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="12.345.678-9"
              required
            />
          </div>

          {/* Proyecto */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Proyecto <span className="text-red-500">*</span>
            </label>
            <select
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Seleccione un proyecto</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* Subproyecto */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Subproyecto
            </label>
            <input
              type="text"
              value={subproyecto}
              onChange={(e) => setSubproyecto(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Opcional"
            />
          </div>

          {/* CECO */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              CECO <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={ceco}
              disabled
              className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-100 text-gray-700"
              placeholder={proyectoId ? 'CECO del proyecto' : 'Seleccione un proyecto primero'}
            />
          </div>

          {/* Valor */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Valor <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ej: 500000"
              required
            />
            {valor && parseFloat(valor) > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {formatearValor(parseFloat(valor))}
              </p>
            )}
          </div>

          {/* Glosa */}
          <div className="md:col-span-2">
            <label className="block text-gray-700 font-medium mb-2">
              Glosa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={glosa}
              onChange={(e) => setGlosa(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Descripción breve de la solicitud"
              required
            />
          </div>

          {/* Detalle */}
          <div className="md:col-span-2">
            <label className="block text-gray-700 font-medium mb-2">
              Detalle
            </label>
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Información adicional (opcional)"
            />
          </div>

          {/* Archivos */}
          <div className="md:col-span-2">
            <label className="block text-gray-700 font-medium mb-2">
              Archivos Adjuntos <span className="text-red-500">*</span>
            </label>
            <input
              id="file-input"
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff,.heic,.heif"
            />
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-sm ${archivos.length >= adjuntosRequeridos ? 'text-green-600' : 'text-red-600'} font-medium`}>
                {archivos.length} archivo(s) seleccionado(s)
              </span>
              <span className="text-sm text-gray-600">
                (Mínimo requerido: {adjuntosRequeridos})
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Formatos permitidos: PDF e imágenes (PNG, JPG, JPEG, WEBP, BMP, GIF, TIFF, HEIC, HEIF).
              Las imágenes se convierten a WEBP automáticamente. Tamaño máximo por archivo: {MAX_ADJUNTO_MB}MB.
            </p>
            {valor && parseFloat(valor) >= 1500000 && (
              <p className="text-sm text-orange-600 mt-1">
                Importante: para valores mayores o iguales a $1,500,000 se requieren 3 archivos adjuntos
              </p>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-lg text-white font-medium transition-all disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: '#FF5100' }}
          >
            {loading ? 'Procesando...' : 'Enviar Solicitud'}
          </button>
          <button
            type="button"
            onClick={limpiarFormulario}
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium transition-all"
          >
            Limpiar
          </button>
        </div>
      </form>

      {/* Historial de solicitudes */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h3 className="text-xl font-bold text-gray-800">
            Mis Solicitudes - {perfil?.empresa === 'HUB_MET' ? 'HUB MET' : 'CGV'}
          </h3>
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {solicitudes.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No hay solicitudes registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                  <FilterableTh col="id" label="ID" style={{ width: '80px' }}
                    opciones={opcionesId} filtro={filtros.id || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'id'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'id'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="proveedor" label="Proveedor"
                    opciones={opcionesProveedor} filtro={filtros.proveedor || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'proveedor'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'proveedor'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="glosa" label="Glosa"
                    opciones={opcionesGlosa} filtro={filtros.glosa || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'glosa'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'glosa'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="proyecto" label="Proyecto"
                    opciones={opcionesProyecto} filtro={filtros.proyecto || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'proyecto'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'proyecto'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="valor" label="Valor" align="right" style={{ width: '130px' }}
                    opciones={opcionesValor} filtro={filtros.valor || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'valor'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'valor'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="fecha" label="Fecha" style={{ width: '110px' }}
                    opciones={opcionesFecha} filtro={filtros.fecha || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'fecha'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'fecha'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="estado" label="Estado" style={{ width: '140px' }}
                    opciones={opcionesEstado} filtro={filtros.estado || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'estado'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'estado'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="netsuite" label="Sol. NetSuite" style={{ width: '130px' }}
                    opciones={opcionesNetsuite} filtro={filtros.netsuite || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'netsuite'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'netsuite'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                </tr>
              </thead>
              <tbody>
                {solicitudesFiltradas.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-500">Sin resultados para los filtros aplicados.</td></tr>
                )}
                {solicitudesFiltradas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA).map((s) => (
                  <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800 font-medium">{s.id_correlativo || '-'}</td>
                    <td className="py-3 px-4 text-gray-800">{s.proveedor}</td>
                    <td className="py-3 px-4 text-gray-800">{s.glosa}</td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.proyecto_nombre}</td>
                    <td className="py-3 px-4 text-gray-800 font-semibold text-right">{formatearValor(s.valor)}</td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{new Date(s.fecha_creacion).toLocaleDateString('es-CL')}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        s.estado === 'enviada' ? 'bg-blue-100 text-blue-800' :
                        s.estado === 'procesada' ? 'bg-purple-100 text-purple-800' :
                        s.estado === 'en adquisiciones' ? 'bg-yellow-100 text-yellow-800' :
                        s.estado === 'ok adquisiciones' ? 'bg-green-100 text-green-800' :
                        s.estado === 'finalizado flujo' ? 'bg-green-200 text-green-900' :
                        s.estado === 'anulada' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>{s.estado}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.sol_netsuite || '-'}</td>
                  </tr>
                ))}
                {solicitudesFiltradas.length > 0 && (
                  <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                    <td colSpan={4} className="py-3 px-4 text-gray-800 text-sm">TOTAL: {solicitudesFiltradas.length} de {solicitudes.length}</td>
                    <td className="py-3 px-4 text-right text-gray-800">{formatearValor(totalValor)}</td>
                    <td colSpan={3} />
                  </tr>
                )}
              </tbody>
            </table>
            {solicitudesFiltradas.length > FILAS_POR_PAGINA && (
              <div className="flex justify-between items-center py-2 px-2 text-sm text-gray-600 border-t border-gray-200">
                <span>{pagina * FILAS_POR_PAGINA + 1}–{Math.min((pagina + 1) * FILAS_POR_PAGINA, solicitudesFiltradas.length)} de {solicitudesFiltradas.length}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
                  <button onClick={() => setPagina(p => p + 1)} disabled={(pagina + 1) * FILAS_POR_PAGINA >= solicitudesFiltradas.length}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

