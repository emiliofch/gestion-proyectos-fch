import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'

function buildTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

function normalizarCeco(raw) {
  const value = String(raw || '').trim()
  return value || null
}

function esEncabezadoCeco(valor) {
  const txt = String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return ['ceco', 'centro de costo', 'centro costo', 'linea'].includes(txt)
}

export default function VistaCentrosCosto({ perfil }) {
  const [centros, setCentros] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    cargarCentros()
  }, [])

  async function cargarCentros() {
    setLoading(true)
    let query = supabase
      .from('centros_costo')
      .select('id, ceco, empresa')
      .order('ceco', { ascending: true })
    if (perfil?.empresa) query = query.eq('empresa', perfil.empresa)

    const { data, error } = await query

    if (error) {
      toast.error('Error cargando centros de costo: ' + error.message)
      setCentros([])
    } else {
      setCentros(data || [])
    }
    setLoading(false)
  }

  async function importarExcel(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setProcesando(true)
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        const candidatos = rows
          .map((r) => normalizarCeco(Array.isArray(r) ? r[0] : null))
          .filter((v) => v && !esEncabezadoCeco(v))

        if (candidatos.length === 0) {
          toast.warning('El archivo no contiene valores en la primera columna')
          return
        }

        const unicos = [...new Set(candidatos)]
        const payload = unicos.map((ceco) => ({ ceco }))

        const { data: existentes } = await supabase
          .from('centros_costo')
          .select('ceco')
          .in('ceco', unicos)

        const existentesSet = new Set((existentes || []).map((r) => r.ceco))
        const nuevos = payload.filter((r) => !existentesSet.has(r.ceco))

        if (nuevos.length === 0) {
          toast.info('No hay nuevos centros de costo para importar')
          return
        }

        const { error } = await supabase.from('centros_costo').insert(nuevos)
        if (error) {
          toast.error('Error importando centros de costo: ' + error.message)
          return
        }

        toast.success(`Importación completada: ${nuevos.length} centro(s) de costo`)
        await cargarCentros()
      } catch (error) {
        toast.error('Error leyendo Excel: ' + error.message)
      } finally {
        setProcesando(false)
        e.target.value = ''
      }
    }

    reader.readAsBinaryString(file)
  }

  function exportarExcel() {
    const ws = XLSX.utils.json_to_sheet(centrosFiltrados.map((c) => ({ CECO: c.ceco })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'CentrosCosto')
    XLSX.writeFile(wb, `centros_costo_${buildTimestamp()}.xlsx`)
  }

  const centrosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return centros
    return centros.filter((c) => c.ceco?.toLowerCase().includes(q))
  }, [centros, busqueda])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Centros de Costo</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar CECO..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={exportarExcel}
            disabled={centrosFiltrados.length === 0}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#6366F1' }}
          >
            Exportar Excel
          </button>
          <label
            className={`px-4 py-2 rounded-lg text-white font-medium transition-all cursor-pointer hover:opacity-90 ${procesando ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: '#10B981' }}
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
        </div>
      </div>

      <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-sm text-gray-600">
          Esta tabla alimenta el dropdown de <strong>Línea</strong> al crear/editar proyectos.
        </p>
        <p className="text-sm text-gray-700 mt-1">
          Formato de importación: el archivo Excel debe tener encabezado <strong>CECO</strong> en la columna A.
        </p>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando centros de costo...</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">CECO</th>
              </tr>
            </thead>
            <tbody>
              {centrosFiltrados.map((c) => (
                <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-3 px-4 text-gray-800">{c.ceco}</td>
                </tr>
              ))}
              {centrosFiltrados.length === 0 && (
                <tr>
                  <td className="py-10 px-4 text-center text-gray-500">
                    No hay centros de costo cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
