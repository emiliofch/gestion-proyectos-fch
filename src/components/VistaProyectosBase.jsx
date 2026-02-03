import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function VistaProyectosBase() {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    cargarProyectos()
  }, [])

  async function cargarProyectos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error cargando proyectos:', error)
    } else {
      setProyectos(data || [])
    }
    setLoading(false)
  }

  const proyectosFiltrados = proyectos.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.ceco?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.jefe?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Proyectos</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar proyecto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-sm text-gray-500">
            {proyectosFiltrados.length} de {proyectos.length} proyectos
          </span>
        </div>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-sm text-gray-600">
          Esta tabla muestra los proyectos base del sistema. Para agregar estimaciones de ingresos, HH y GGOO, ve a <strong>Oportunidades</strong>.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando proyectos...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">#</th>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">Proyecto</th>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">Centro de Costo</th>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">Jefe de Proyecto</th>
              </tr>
            </thead>
            <tbody>
              {proyectosFiltrados.map((p, index) => (
                <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-3 px-4 text-gray-500 text-sm">{index + 1}</td>
                  <td className="py-3 px-4 text-gray-800 font-medium">{p.nombre}</td>
                  <td className="py-3 px-4 text-gray-600 text-sm">{p.ceco}</td>
                  <td className="py-3 px-4 text-gray-600">{p.jefe || <span className="text-gray-400 italic">Sin asignar</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
