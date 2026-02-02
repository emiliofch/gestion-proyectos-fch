import { useState } from 'react'
import { toast } from 'react-toastify'

export default function VistaSugerencias({
  sugerencias,
  votos,
  filtroEstado,
  setFiltroEstado,
  crearSugerencia,
  votarSugerencia,
  cambiarEstadoSugerencia,
  borrarSugerencia,
  perfil,
  user,
  loading
}) {
  const [nuevaSugerencia, setNuevaSugerencia] = useState('')

  const estados = ['sugerido', 'comenzado', 'finalizado', 'descartado']
  const coloresEstado = {
    sugerido: '#3B82F6',
    comenzado: '#F59E0B',
    finalizado: '#10B981',
    descartado: '#EF4444'
  }

  let sugerenciasFiltradas = sugerencias

  if (filtroEstado) {
    sugerenciasFiltradas = sugerenciasFiltradas.filter(s => s.estado === filtroEstado)
  }

  sugerenciasFiltradas = [...sugerenciasFiltradas].sort((a, b) => 
    new Date(b.fecha_creacion) - new Date(a.fecha_creacion)
  )

  async function enviarSugerencia() {
    if (!nuevaSugerencia.trim()) {
      toast.warning('La sugerencia no puede estar vacía')
      return
    }
    await crearSugerencia(nuevaSugerencia)
    setNuevaSugerencia('')
  }

  function formatearFecha(fecha) {
    const d = new Date(fecha)
    return d.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: '#FF5100' }}>
        💡 Sistema de Sugerencias
      </h2>

      {/* Crear nueva sugerencia */}
      <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-gray-800 mb-3">Proponer una sugerencia</h3>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={nuevaSugerencia}
            onChange={(e) => setNuevaSugerencia(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && enviarSugerencia()}
            placeholder="Escribe tu sugerencia aquí..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={enviarSugerencia}
            disabled={loading}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Filtros por estado */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroEstado('')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filtroEstado === '' 
              ? 'bg-gray-800 text-white' 
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          Todas ({sugerencias.length})
        </button>
        {estados.map(estado => {
          const count = sugerencias.filter(s => s.estado === estado).length
          return (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                filtroEstado === estado
                  ? 'text-white'
                  : 'text-gray-800 bg-gray-200 hover:bg-gray-300'
              }`}
              style={{
                backgroundColor: filtroEstado === estado ? coloresEstado[estado] : undefined
              }}
            >
              {estado} ({count})
            </button>
          )
        })}
      </div>

      {/* Lista de sugerencias */}
      <div className="space-y-4">
        {sugerenciasFiltradas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No hay sugerencias en este estado</p>
          </div>
        ) : (
          sugerenciasFiltradas.map(sugerencia => {
            const votosCount = votos.filter(v => v.sugerencia_id === sugerencia.id).length
            const usuarioVoto = votos.find(v => v.sugerencia_id === sugerencia.id && v.user_id === user.id)

            return (
              <div
                key={sugerencia.id}
                className="p-4 border-l-4 rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white"
                style={{ borderLeftColor: coloresEstado[sugerencia.estado] }}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {sugerencia.texto}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>👤 {sugerencia.usuario}</span>
                      <span>📅 {formatearFecha(sugerencia.fecha_creacion)}</span>
                      <span
                        className="px-3 py-1 rounded-full text-white font-medium capitalize"
                        style={{ backgroundColor: coloresEstado[sugerencia.estado] }}
                      >
                        {sugerencia.estado}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:items-end">
                    {/* Votos */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => votarSugerencia(sugerencia.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          usuarioVoto
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                        }`}
                      >
                        👍 {votosCount}
                      </button>
                    </div>

                    {/* Cambiar estado - solo admin */}
                    {perfil?.rol === 'admin' && (
                      <div className="flex gap-2">
                        <select
                          value={sugerencia.estado}
                          onChange={(e) => cambiarEstadoSugerencia(sugerencia.id, e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={loading}
                        >
                          {estados.map(estado => (
                            <option key={estado} value={estado} className="capitalize">
                              {estado}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => borrarSugerencia(sugerencia.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all disabled:opacity-50 font-medium"
                          disabled={loading}
                          title="Eliminar sugerencia"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
