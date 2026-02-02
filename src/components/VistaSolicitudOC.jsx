import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

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

  const tiposDocumento = [
    { value: 'factura', label: 'Factura' },
    { value: 'factura_exenta', label: 'Factura Exenta' },
    { value: 'boleta_honorarios', label: 'Boleta de Honorarios' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'otro', label: 'Otro' }
  ]

  useEffect(() => {
    cargarProyectos()
    cargarSolicitudes()
  }, [])

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
    const { data } = await supabase
      .from('solicitudes_oc')
      .select('*, proyectos(nombre)')
      .order('fecha_creacion', { ascending: false })

    setSolicitudes(data || [])
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files)

    const maxSize = 10 * 1024 * 1024
    const archivosValidos = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} excede el tamaño máximo de 10MB`)
        return false
      }
      return true
    })

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

    console.log('=== DEBUG: Subiendo archivos ===')
    console.log('Solicitud ID:', solicitudId)
    console.log('User ID:', user.id)
    console.log('Total archivos:', archivos.length)

    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i]
      const extension = archivo.name.split('.').pop()
      const nombreArchivo = `${user.id}/${solicitudId}/${Date.now()}_${i}.${extension}`

      console.log(`\n--- Subiendo archivo ${i + 1}/${archivos.length} ---`)
      console.log('Nombre original:', archivo.name)
      console.log('Path destino:', nombreArchivo)
      console.log('Tamaño:', (archivo.size / 1024 / 1024).toFixed(2), 'MB')
      console.log('Tipo:', archivo.type)

      const { data, error } = await supabase.storage
        .from('oc-adjuntos')
        .upload(nombreArchivo, archivo)

      if (error) {
        console.error('❌ ERROR SUBIENDO ARCHIVO:')
        console.error('Error completo:', error)
        console.error('Mensaje:', error.message)
        console.error('Status:', error.statusCode)
        console.error('Código:', error.error)
        console.error('Detalles:', error.details || error.hint)
        console.error('=================================')
        throw new Error(`Error al subir ${archivo.name}: ${error.message}`)
      }

      console.log('✓ Archivo subido exitosamente:', data.path)

      archivosSubidos.push({
        nombre: archivo.name,
        path: data.path,
        size: archivo.size,
        type: archivo.type
      })
    }

    console.log('\n✓ Todos los archivos subidos exitosamente')
    console.log('================================')
    return archivosSubidos
  }

  async function enviarCorreos(solicitud, archivosInfo) {
    const proyecto = proyectos.find(p => p.id === proyectoId)

    console.log('=== DEBUG: Generando URLs de descarga ===')

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

        console.log('✓ URL generada para:', archivo.nombre)
        return { ...archivo, url: data.signedUrl }
      })
    )

    console.log('URLs generadas:', archivosConUrls)
    console.log('====================================')

    const payload = {
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
      usuarioEmail: user.email
    }

    const response = await fetch('/api/enviar-email-oc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Error al enviar correos')
    }

    return response.json()
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!validarFormulario()) return

    setLoading(true)

    try {
      const proyecto = proyectos.find(p => p.id === proyectoId)

      // Debug: Log de datos antes de insertar
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
        usuario_email: user.email
      }

      console.log('=== DEBUG: Datos a insertar ===')
      console.log('CECO length:', ceco?.length, 'caracteres')
      console.log('CECO value:', ceco)
      console.log('Todos los datos:', datosParaInsertar)
      console.log('===============================')

      // 1. Crear solicitud en BD
      const { data: solicitud, error: errorSolicitud } = await supabase
        .from('solicitudes_oc')
        .insert(datosParaInsertar)
        .select()
        .single()

      if (errorSolicitud) {
        console.error('=== ERROR DE SUPABASE ===')
        console.error('Error completo:', errorSolicitud)
        console.error('Código:', errorSolicitud.code)
        console.error('Mensaje:', errorSolicitud.message)
        console.error('Detalles:', errorSolicitud.details)
        console.error('========================')
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

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: '#FF5100' }}>
        🧾 Solicitud de Orden de Compra
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
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
            />
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-sm ${archivos.length >= adjuntosRequeridos ? 'text-green-600' : 'text-red-600'} font-medium`}>
                {archivos.length} archivo(s) seleccionado(s)
              </span>
              <span className="text-sm text-gray-600">
                (Mínimo requerido: {adjuntosRequeridos})
              </span>
            </div>
            {valor && parseFloat(valor) >= 1500000 && (
              <p className="text-sm text-orange-600 mt-1">
                ⚠️ Para valores mayores o iguales a $1,500,000 se requieren 3 archivos adjuntos
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
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Mis Solicitudes</h3>

        {solicitudes.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No hay solicitudes registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold">Fecha</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold">Tipo</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold">Proveedor</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold">Proyecto</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold">Valor</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map(s => (
                  <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800 text-sm">
                      {new Date(s.fecha_creacion).toLocaleDateString('es-CL')}
                    </td>
                    <td className="py-3 px-4 text-gray-800 capitalize">
                      {s.tipo.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-gray-800">{s.proveedor}</td>
                    <td className="py-3 px-4 text-gray-800">{s.proyecto_nombre}</td>
                    <td className="py-3 px-4 text-gray-800 font-semibold">
                      {formatearValor(s.valor)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        s.estado === 'enviada' ? 'bg-blue-100 text-blue-800' :
                        s.estado === 'aprobada' ? 'bg-green-100 text-green-800' :
                        s.estado === 'rechazada' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {s.estado.charAt(0).toUpperCase() + s.estado.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
