import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [oportunidades, setOportunidades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarOportunidades()
  }, [])

  async function cargarOportunidades() {
    setLoading(true)
    const { data, error } = await supabase
      .from('oportunidades')
      .select(`
        *,
        proyectos:proyecto_id (nombre, ceco, jefe)
      `)

    if (error) {
      console.error('Error cargando oportunidades:', error)
    } else {
      setOportunidades(data || [])
    }
    setLoading(false)
  }

  const totalOportunidades = oportunidades.length
  const totalIngresos = oportunidades.reduce((sum, o) => sum + (parseFloat(o.ingresos) || 0), 0)
  const totalHH = oportunidades.reduce((sum, o) => sum + (parseFloat(o.hh) || 0), 0)
  const totalGastos = oportunidades.reduce((sum, o) => sum + (parseFloat(o.gastos) || 0), 0)
  const margenTotal = totalIngresos - totalHH - totalGastos
  const margenPromedio = totalOportunidades > 0 ? margenTotal / totalOportunidades : 0
  const roi = totalIngresos > 0 ? ((margenTotal / totalIngresos) * 100) : 0

  const oportunidadesPositivas = oportunidades.filter(o => {
    const margen = (parseFloat(o.ingresos) || 0) - (parseFloat(o.hh) || 0) - (parseFloat(o.gastos) || 0)
    return margen >= 0
  }).length

  const oportunidadesNegativas = totalOportunidades - oportunidadesPositivas

  const pieData = [
    { name: 'Positivos', value: oportunidadesPositivas },
    { name: 'Negativos', value: oportunidadesNegativas }
  ]

  const topOportunidades = [...oportunidades]
    .map(o => ({
      nombre: o.proyectos?.nombre || 'Sin proyecto',
      nombreCorto: (o.proyectos?.nombre || 'Sin proyecto').length > 15
        ? (o.proyectos?.nombre || 'Sin proyecto').substring(0, 15) + '...'
        : (o.proyectos?.nombre || 'Sin proyecto'),
      margen: (parseFloat(o.ingresos) || 0) - (parseFloat(o.hh) || 0) - (parseFloat(o.gastos) || 0)
    }))
    .sort((a, b) => b.margen - a.margen)
    .slice(0, 5)

  // Datos de distribución de HH por proyecto
  const hhDistribucion = [...oportunidades]
    .map(o => ({
      nombre: o.proyectos?.nombre || 'Sin proyecto',
      nombreCorto: (o.proyectos?.nombre || 'Sin proyecto').length > 15
        ? (o.proyectos?.nombre || 'Sin proyecto').substring(0, 15) + '...'
        : (o.proyectos?.nombre || 'Sin proyecto'),
      hh: parseFloat(o.hh) || 0
    }))
    .sort((a, b) => b.hh - a.hh)
    .slice(0, 5)

  // Datos de desempeño por jefe
  const jefeStats = {}
  oportunidades.forEach(o => {
    const jefe = o.proyectos?.jefe || 'Sin asignar'
    if (!jefeStats[jefe]) {
      jefeStats[jefe] = {
        total: 0,
        suma_margen: 0,
        cantidad: 0
      }
    }
    const margen = (parseFloat(o.ingresos) || 0) - (parseFloat(o.hh) || 0) - (parseFloat(o.gastos) || 0)
    jefeStats[jefe].suma_margen += margen
    jefeStats[jefe].cantidad += 1
    jefeStats[jefe].total = (jefeStats[jefe].suma_margen / jefeStats[jefe].cantidad).toFixed(1)
  })

  const jefeData = Object.entries(jefeStats)
    .map(([jefe, stats]) => ({
      jefe: jefe.length > 15 ? jefe.substring(0, 15) + '...' : jefe,
      jefe_completo: jefe,
      margen_promedio: parseFloat(stats.total),
      cantidad: stats.cantidad
    }))
    .sort((a, b) => b.margen_promedio - a.margen_promedio)

  const getColorByMargen = (margen) => {
    if (margen >= 50) return '#10B981' // Verde oscuro
    if (margen >= 20) return '#86EFAC' // Verde claro
    if (margen >= 0) return '#FBBF24' // Amarillo
    return '#EF4444' // Rojo
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cargando dashboard...</p>
      </div>
    )
  }

  if (oportunidades.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg mb-2">No hay oportunidades registradas</p>
          <p className="text-gray-400 text-sm">Importa oportunidades desde la seccion Oportunidades para ver las estadisticas</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90">Total Oportunidades</div>
          <div className="text-3xl font-bold mt-2">{totalOportunidades}</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90">Ingresos Totales</div>
          <div className="text-3xl font-bold mt-2">{totalIngresos.toFixed(1)}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90">Margen Total</div>
          <div className="text-3xl font-bold mt-2">{margenTotal.toFixed(1)}</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90">Margen Promedio</div>
          <div className="text-3xl font-bold mt-2">{margenPromedio.toFixed(1)}</div>
        </div>

        <div className={`bg-gradient-to-br rounded-lg p-6 text-white font-bold text-center ${roi >= 20 ? 'from-emerald-500 to-emerald-600' : roi >= 10 ? 'from-yellow-500 to-yellow-600' : 'from-red-500 to-red-600'}`}>
          <div className="text-sm opacity-90">ROI</div>
          <div className="text-3xl font-bold mt-2">{roi.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Distribucion de Margenes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#EF4444'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Top 5 Oportunidades por Margen</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topOportunidades} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombreCorto" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-2 border border-gray-300 rounded shadow-lg">
                        <p className="font-semibold text-gray-800">{data.nombre}</p>
                        <p className="text-blue-600">Margen: {data.margen.toFixed(1)}</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="margen" fill="#FF5100" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Distribución de HH */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Top 5 por HH</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hhDistribucion} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombreCorto" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-2 border border-gray-300 rounded shadow-lg">
                        <p className="font-semibold text-gray-800">{data.nombre}</p>
                        <p className="text-blue-600">HH: {data.hh.toFixed(1)}</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="hh" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Desempeño por Jefe */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Desempeno por Jefe (Margen Promedio)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={jefeData} margin={{ top: 20, right: 30, left: 100, bottom: 20 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="jefe" type="category" width={95} tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-2 border border-gray-300 rounded shadow-lg">
                        <p className="font-semibold text-gray-800">{data.jefe_completo}</p>
                        <p className="text-blue-600">Margen Promedio: {data.margen_promedio.toFixed(1)}</p>
                        <p className="text-gray-600 text-sm">Oportunidades: {data.cantidad}</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="margen_promedio" radius={[0, 8, 8, 0]}>
                {jefeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColorByMargen(entry.margen_promedio)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Resumen</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-600">Oportunidades con margen positivo:</p>
            <p className="text-2xl font-bold text-green-600">{oportunidadesPositivas} ({totalOportunidades > 0 ? ((oportunidadesPositivas / totalOportunidades) * 100).toFixed(1) : 0}%)</p>
          </div>
          <div>
            <p className="text-gray-600">Oportunidades con margen negativo:</p>
            <p className="text-2xl font-bold text-red-600">{oportunidadesNegativas} ({totalOportunidades > 0 ? ((oportunidadesNegativas / totalOportunidades) * 100).toFixed(1) : 0}%)</p>
          </div>
          <div>
            <p className="text-gray-600">Total HH:</p>
            <p className="text-2xl font-bold text-blue-600">{totalHH.toFixed(1)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
