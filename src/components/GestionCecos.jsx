import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

export default function GestionCecos() {
  const [proyectos, setProyectos] = useState([])
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState('')
  const [cecos, setCecos] = useState([])
  const [nuevoCeco, setNuevoCeco] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    cargarProyectos()
  }, [])

  useEffect(() => {
    if (proyectoSeleccionado) {
      cargarCecos(proyectoSeleccionado)
    } else {
      setCecos([])
    }
  }, [proyectoSeleccionado])

  async function cargarProyectos() {
    const { data } = await supabase.from('proyectos').select('*').order('nombre')
    setProyectos(data || [])
  }

  async function cargarCecos(proyectoId) {
    const { data } = await supabase
      .from('proyectos_ceco')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('ceco')

    setCecos(data || [])
  }

  async function agregarCeco(e) {
    e.preventDefault()

    if (!proyectoSeleccionado) {
      toast.warning('Seleccione un proyecto')
      return
    }

    if (!nuevoCeco.trim()) {
      toast.warning('Ingrese un código CECO')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('proyectos_ceco').insert({
      proyecto_id: proyectoSeleccionado,
      ceco: nuevoCeco.trim(),
      descripcion: descripcion.trim() || null,
      activo: true
    })

    if (error) {
      if (error.code === '23505') {
        toast.error('Este CECO ya existe para el proyecto')
      } else {
        toast.error('Error: ' + error.message)
      }
    } else {
      toast.success('CECO agregado exitosamente')
      setNuevoCeco('')
      setDescripcion('')
      cargarCecos(proyectoSeleccionado)
    }

    setLoading(false)
  }

  async function toggleActivo(cecoId, activo) {
    const { error } = await supabase
      .from('proyectos_ceco')
      .update({ activo: !activo })
      .eq('id', cecoId)

    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      toast.success(activo ? 'CECO desactivado' : 'CECO activado')
      cargarCecos(proyectoSeleccionado)
    }
  }

  async function eliminarCeco(cecoId) {
    if (!confirm('¿Está seguro de eliminar este CECO?')) return

    const { error } = await supabase
      .from('proyectos_ceco')
      .delete()
      .eq('id', cecoId)

    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      toast.success('CECO eliminado')
      cargarCecos(proyectoSeleccionado)
    }
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-gray-800 mb-6">Gestión de CECOs</h3>

      {/* Selector de proyecto */}
      <div className="mb-6">
        <label className="block text-gray-700 font-medium mb-2">Proyecto</label>
        <select
          value={proyectoSeleccionado}
          onChange={(e) => setProyectoSeleccionado(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Seleccione un proyecto</option>
          {proyectos.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {proyectoSeleccionado && (
        <>
          {/* Formulario agregar CECO */}
          <form onSubmit={agregarCeco} className="bg-gray-50 rounded-lg p-6 mb-6">
            <h4 className="font-semibold text-gray-800 mb-4">Agregar Nuevo CECO</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Código CECO</label>
                <input
                  type="text"
                  value={nuevoCeco}
                  onChange={(e) => setNuevoCeco(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ej: CECO-2024-001"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Descripción (opcional)</label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Descripción del CECO"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 px-6 py-2 rounded-lg text-white font-medium transition-all disabled:opacity-50"
              style={{ backgroundColor: '#FF5100' }}
            >
              Agregar CECO
            </button>
          </form>

          {/* Lista de CECOs */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="font-semibold text-gray-800 mb-4">
              CECOs del Proyecto ({cecos.length})
            </h4>

            {cecos.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                No hay CECOs asignados a este proyecto
              </p>
            ) : (
              <div className="space-y-2">
                {cecos.map(c => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      c.activo ? 'bg-white border-gray-300' : 'bg-gray-100 border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{c.ceco}</p>
                      {c.descripcion && (
                        <p className="text-sm text-gray-600">{c.descripcion}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleActivo(c.id, c.activo)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          c.activo
                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {c.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => eliminarCeco(c.id)}
                        className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
