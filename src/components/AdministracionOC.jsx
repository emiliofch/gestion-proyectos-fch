import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

export default function AdministracionOC() {
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState(null)

  const estadosDisponibles = [
    'enviada',
    'procesada',
    'en adquisiciones',
    'ok adquisiciones',
    'finalizado flujo',
    'anulada'
  ]

  useEffect(() => {
    cargarTodasLasSolicitudes()
  }, [])

  async function cargarTodasLasSolicitudes() {
    setLoading(true)
    const { data } = await supabase
      .from('solicitudes_oc')
      .select('*, proyectos(nombre)')
      .order('fecha_creacion', { ascending: false })

    setSolicitudes(data || [])
    setLoading(false)
  }

  async function actualizarSolicitud(id, campo, valor) {
    const { error } = await supabase
      .from('solicitudes_oc')
      .update({ [campo]: valor })
      .eq('id', id)

    if (error) {
      console.error('Error actualizando solicitud:', error)
      toast.error('Error al actualizar: ' + error.message)
    } else {
      toast.success('Solicitud actualizada')
      cargarTodasLasSolicitudes()
      setEditando(null)
    }
  }

  function formatearValor(val) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(val)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800" style={{ color: '#FF5100' }}>
          🔧 Administración de OC
        </h2>
        <button
          onClick={cargarTodasLasSolicitudes}
          className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-all"
          disabled={loading}
        >
          {loading ? 'Cargando...' : '🔄 Actualizar'}
        </button>
      </div>

      {solicitudes.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No hay solicitudes OC registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold text-sm">Autor</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold text-sm">ID</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold text-sm">Proveedor</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold text-sm">Glosa</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold text-sm">Subproyecto</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold text-sm">Proyecto</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold text-sm">Valor</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold text-sm">Fecha</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold text-sm">Sol. NetSuite</th>
                  <th className="text-left py-3 px-4 text-gray-800 font-semibold text-sm">Estado</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s, index) => (
                  <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.usuario_email}</td>
                    <td className="py-3 px-4 text-gray-800 font-medium">{s.id_correlativo || '-'}</td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.proveedor}</td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.glosa}</td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.subproyecto || '-'}</td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.proyecto_nombre}</td>
                    <td className="py-3 px-4 text-gray-800 font-semibold text-sm">
                      {formatearValor(s.valor)}
                    </td>
                    <td className="py-3 px-4 text-gray-800 text-sm">
                      {new Date(s.fecha_creacion).toLocaleDateString('es-CL')}
                    </td>

                    {/* Sol. NetSuite - Editable */}
                    <td className="py-3 px-4">
                      {editando === `${s.id}-netsuite` ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            defaultValue={s.sol_netsuite || ''}
                            onBlur={(e) => actualizarSolicitud(s.id, 'sol_netsuite', e.target.value || null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                actualizarSolicitud(s.id, 'sol_netsuite', e.target.value || null)
                              }
                              if (e.key === 'Escape') {
                                setEditando(null)
                              }
                            }}
                            autoFocus
                            className="w-32 px-2 py-1 border border-orange-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditando(`${s.id}-netsuite`)}
                          className="text-sm text-gray-800 hover:text-orange-600 underline"
                        >
                          {s.sol_netsuite || 'Agregar'}
                        </button>
                      )}
                    </td>

                    {/* Estado - Editable con dropdown */}
                    <td className="py-3 px-4">
                      <select
                        value={s.estado}
                        onChange={(e) => actualizarSolicitud(s.id, 'estado', e.target.value)}
                        className="px-3 py-1 rounded-full text-xs font-medium border-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
                        style={{
                          borderColor:
                            s.estado === 'enviada' ? '#3B82F6' :
                            s.estado === 'procesada' ? '#A855F7' :
                            s.estado === 'en adquisiciones' ? '#EAB308' :
                            s.estado === 'ok adquisiciones' ? '#10B981' :
                            s.estado === 'finalizado flujo' ? '#059669' :
                            s.estado === 'anulada' ? '#EF4444' :
                            '#6B7280',
                          backgroundColor:
                            s.estado === 'enviada' ? '#DBEAFE' :
                            s.estado === 'procesada' ? '#F3E8FF' :
                            s.estado === 'en adquisiciones' ? '#FEF3C7' :
                            s.estado === 'ok adquisiciones' ? '#D1FAE5' :
                            s.estado === 'finalizado flujo' ? '#D1FAE5' :
                            s.estado === 'anulada' ? '#FEE2E2' :
                            '#F3F4F6',
                          color:
                            s.estado === 'enviada' ? '#1E40AF' :
                            s.estado === 'procesada' ? '#7C3AED' :
                            s.estado === 'en adquisiciones' ? '#A16207' :
                            s.estado === 'ok adquisiciones' ? '#047857' :
                            s.estado === 'finalizado flujo' ? '#047857' :
                            s.estado === 'anulada' ? '#B91C1C' :
                            '#374151'
                        }}
                      >
                        {estadosDisponibles.map(estado => (
                          <option key={estado} value={estado}>{estado}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Total de solicitudes: <span className="font-semibold">{solicitudes.length}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
