import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import * as XLSX from 'xlsx'
import { toast } from 'react-hot-toast'

export default function VistaOportunidades({ user }) {
  const [oportunidades, setOportunidades] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)

    // Cargar proyectos para referencia
    const { data: proyectosData } = await supabase
      .from('proyectos')
      .select('id, nombre, ceco, jefe')

    setProyectos(proyectosData || [])

    // Cargar oportunidades con join a proyectos
    const { data: oportunidadesData, error } = await supabase
      .from('oportunidades')
      .select(`
        *,
        proyectos:proyecto_id (nombre, ceco, jefe)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error cargando oportunidades:', error)
    } else {
      setOportunidades(oportunidadesData || [])
    }
    setLoading(false)
  }

  async function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return

    setProcesando(true)
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        console.log('=== INICIO IMPORTACIÓN OPORTUNIDADES ===')
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet)

        console.log('Total filas:', data.length)
        console.log('Columnas:', Object.keys(data[0] || {}))

        let insertados = 0
        let errores = 0
        let noEncontrados = []

        const parseNumero = (val) => {
          if (val === null || val === undefined || val === '') return 0
          if (typeof val === 'number') return val
          return parseFloat(String(val).replace(',', '.')) || 0
        }

        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          const proyectoNombre = row.PROYECTO || row.proyecto || ''
          const ingresos = parseNumero(row.INGRESOS || row.ingresos)
          const hh = parseNumero(row.HH || row.hh)
          const gastos = parseNumero(row.GGOO || row.ggoo || row.GASTOS || row.gastos)

          if (!proyectoNombre.trim()) {
            errores++
            continue
          }

          // Extraer código del proyecto
          const codigoMatch = proyectoNombre.match(/^[\d]+\.[\w]+\.[\w]+/)
          const codigoBusqueda = codigoMatch ? codigoMatch[0] : proyectoNombre.trim()

          // Buscar proyecto
          const { data: encontrados } = await supabase
            .from('proyectos')
            .select('id, nombre')
            .ilike('nombre', `${codigoBusqueda}%`)

          if (!encontrados || encontrados.length === 0) {
            console.log('No encontrado:', proyectoNombre)
            noEncontrados.push(proyectoNombre)
            errores++
            continue
          }

          const proyecto = encontrados[0]

          // Insertar oportunidad
          const { error: errorInsert } = await supabase.from('oportunidades').insert({
            proyecto_id: proyecto.id,
            ingresos,
            hh,
            gastos,
            creador: user.email,
            estado: 'abierta'
          })

          if (errorInsert) {
            console.error('Error insert:', errorInsert)
            errores++
          } else {
            insertados++
          }
        }

        console.log('=== RESUMEN ===')
        console.log('Insertados:', insertados, 'Errores:', errores)

        if (noEncontrados.length > 0) {
          console.log('No encontrados:', noEncontrados)
          toast.error(`${noEncontrados.length} proyectos no encontrados. Ver consola F12.`)
        }

        toast.success(`Importación: ${insertados} oportunidades creadas`)
        cargarDatos()
      } catch (error) {
        console.error('Error:', error)
        toast.error('Error: ' + error.message)
      }
      setProcesando(false)
    }

    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  async function borrarOportunidad(oportunidad) {
    if (!confirm(`¿Eliminar oportunidad del proyecto ${oportunidad.proyectos?.nombre}?`)) return

    const { error } = await supabase
      .from('oportunidades')
      .delete()
      .eq('id', oportunidad.id)

    if (error) {
      toast.error('Error al eliminar')
    } else {
      toast.success('Oportunidad eliminada')
      cargarDatos()
    }
  }

  async function borrarTodas() {
    if (!confirm('¿Eliminar TODAS las oportunidades? Esta acción no se puede deshacer.')) return
    if (!confirm('¿Estás seguro? Se eliminarán todas las oportunidades.')) return

    const { error } = await supabase
      .from('oportunidades')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (error) {
      toast.error('Error al eliminar')
    } else {
      toast.success('Todas las oportunidades eliminadas')
      cargarDatos()
    }
  }

  const oportunidadesFiltradas = oportunidades.filter(o =>
    o.proyectos?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    o.creador?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const totales = oportunidadesFiltradas.reduce((acc, o) => ({
    ingresos: acc.ingresos + (parseFloat(o.ingresos) || 0),
    hh: acc.hh + (parseFloat(o.hh) || 0),
    gastos: acc.gastos + (parseFloat(o.gastos) || 0)
  }), { ingresos: 0, hh: 0, gastos: 0 })

  totales.margen = totales.ingresos - totales.hh - totales.gastos

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Oportunidades</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={() => setMostrarInstrucciones(!mostrarInstrucciones)}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all"
            title="Info formato Excel"
          >
            info
          </button>
          <label
            className="px-4 py-2 rounded-lg text-white font-medium transition-all cursor-pointer hover:opacity-90"
            style={{ backgroundColor: '#FF5100' }}
          >
            {procesando ? 'Procesando...' : 'Importar Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={importarExcel}
              className="hidden"
              disabled={procesando}
            />
          </label>
          <button
            onClick={borrarTodas}
            disabled={loading || oportunidades.length === 0}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all disabled:opacity-50"
          >
            Borrar Todas
          </button>
        </div>
      </div>

      {mostrarInstrucciones && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h3 className="text-gray-800 font-bold mb-2">Formato Excel:</h3>
          <p className="text-gray-700 text-sm mb-2">PROYECTO | INGRESOS | HH | GGOO</p>
          <p className="text-gray-500 text-xs">El codigo del proyecto debe existir en la tabla Proyectos</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando oportunidades...</p>
        </div>
      ) : oportunidades.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg mb-2">No hay oportunidades registradas</p>
          <p className="text-gray-400 text-sm">Importa un archivo Excel para agregar oportunidades</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">Proyecto</th>
                <th className="text-right py-3 px-4 text-gray-800 font-semibold">Ingresos</th>
                <th className="text-right py-3 px-4 text-gray-800 font-semibold">HH</th>
                <th className="text-right py-3 px-4 text-gray-800 font-semibold">GGOO</th>
                <th className="text-right py-3 px-4 text-gray-800 font-semibold">Margen</th>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">Creador</th>
                <th className="text-center py-3 px-4 text-gray-800 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {oportunidadesFiltradas.map(o => {
                const margen = (parseFloat(o.ingresos) || 0) - (parseFloat(o.hh) || 0) - (parseFloat(o.gastos) || 0)
                return (
                  <tr key={o.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                    <td className="py-3 px-4 text-gray-800">{o.proyectos?.nombre || 'Sin proyecto'}</td>
                    <td className="py-3 px-4 text-right text-gray-800">{parseFloat(o.ingresos || 0).toFixed(1)}</td>
                    <td className="py-3 px-4 text-right text-gray-800">{parseFloat(o.hh || 0).toFixed(1)}</td>
                    <td className="py-3 px-4 text-right text-gray-800">{parseFloat(o.gastos || 0).toFixed(1)}</td>
                    <td className={`py-3 px-4 text-right font-bold ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {margen.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">{o.creador}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => borrarOportunidad(o)}
                        className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all text-sm"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                <td className="py-3 px-4 text-gray-800">TOTAL ({oportunidadesFiltradas.length})</td>
                <td className="py-3 px-4 text-right text-gray-800">{totales.ingresos.toFixed(1)}</td>
                <td className="py-3 px-4 text-right text-gray-800">{totales.hh.toFixed(1)}</td>
                <td className="py-3 px-4 text-right text-gray-800">{totales.gastos.toFixed(1)}</td>
                <td className={`py-3 px-4 text-right ${totales.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totales.margen.toFixed(1)}
                </td>
                <td colSpan="2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
