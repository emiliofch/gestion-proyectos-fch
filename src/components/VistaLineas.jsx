import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import FilterableTh from './FilterableTh'

function buildTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

function normalizarLinea(raw) {
  const value = String(raw || '').trim()
  return value || null
}

function esEncabezadoLinea(valor) {
  const txt = String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return ['linea', 'linea de negocio', 'linea negocio'].includes(txt)
}

export default function VistaLineas({ perfil }) {
  const [lineas, setLineas] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('linea')
  const [ordenDir, setOrdenDir] = useState('asc')

  useEffect(() => {
    cargarLineas()
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  async function cargarLineas() {
    setLoading(true)
    let query = supabase
      .from('lineas')
      .select('id, linea, empresa')
      .order('linea', { ascending: true })
    if (perfil?.empresa) query = query.eq('empresa', perfil.empresa)

    const { data, error } = await query

    if (error) {
      toast.error('Error cargando lineas: ' + error.message)
      setLineas([])
    } else {
      setLineas(data || [])
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
          .map((r) => normalizarLinea(Array.isArray(r) ? r[0] : null))
          .filter((v) => v && !esEncabezadoLinea(v))

        if (candidatos.length === 0) {
          toast.warning('El archivo no contiene valores en la primera columna')
          return
        }

        const unicos = [...new Set(candidatos)]
        const payload = unicos.map((linea) => ({ linea }))

        const { data: existentes } = await supabase
          .from('lineas')
          .select('linea')
          .in('linea', unicos)

        const existentesSet = new Set((existentes || []).map((r) => r.linea))
        const nuevos = payload.filter((r) => !existentesSet.has(r.linea))

        if (nuevos.length === 0) {
          toast.info('No hay nuevas lineas para importar')
          return
        }

        const { error } = await supabase.from('lineas').insert(nuevos)
        if (error) {
          toast.error('Error importando lineas: ' + error.message)
          return
        }

        toast.success(`Importacion completada: ${nuevos.length} linea(s)`)
        await cargarLineas()
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
    const ws = XLSX.utils.json_to_sheet(lineasFiltradas.map((l) => ({ LINEA: l.linea })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lineas')
    XLSX.writeFile(wb, `lineas_${buildTimestamp()}.xlsx`)
  }

  const lineasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return lineas.filter((l) => {
      const matchBusqueda = !q || l.linea?.toLowerCase().includes(q)
      const matchFiltro = !filtros.linea?.length || filtros.linea.includes(l.linea)
      return matchBusqueda && matchFiltro
    }).sort((a, b) => {
      const aVal = a.linea || ''
      const bVal = b.linea || ''
      return ordenDir === 'asc'
        ? aVal.localeCompare(bVal, 'es')
        : bVal.localeCompare(aVal, 'es')
    })
  }, [lineas, busqueda, filtros, ordenDir])

  const opcionesLinea = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const base = lineas
      .filter((l) => !q || l.linea?.toLowerCase().includes(q))
      .map((l) => l.linea)
      .filter(Boolean)
    const seleccionadas = Array.isArray(filtros.linea) ? filtros.linea : []
    return [...new Set([...base, ...seleccionadas])].sort((a, b) => a.localeCompare(b, 'es'))
  }, [lineas, busqueda, filtros.linea])

  function setFiltro(col, valor) {
    setFiltros((prev) => ({ ...prev, [col]: valor }))
  }

  function toggleOrden(col) {
    if (ordenCol === col) {
      setOrdenDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setOrdenCol(col)
      setOrdenDir('asc')
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Lineas</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar linea..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={exportarExcel}
            disabled={lineasFiltradas.length === 0}
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
        <p className="text-sm text-gray-700">
          Formato de importacion: el archivo Excel debe tener encabezado <strong>LINEA</strong> en la columna A.
        </p>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando lineas...</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                <FilterableTh
                  col="linea"
                  label="Linea"
                  opciones={opcionesLinea}
                  filtro={filtros.linea || []}
                  onFiltro={setFiltro}
                  dropdownAbierto={dropdownFiltro === 'linea'}
                  onToggleDropdown={setDropdownFiltro}
                  sortable
                  ordenActiva={ordenCol === 'linea'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
              </tr>
            </thead>
            <tbody>
              {lineasFiltradas.map((l) => (
                <tr key={l.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-3 px-4 text-gray-800">{l.linea}</td>
                </tr>
              ))}
              {lineasFiltradas.length === 0 && (
                <tr>
                  <td className="py-10 px-4 text-center text-gray-500">
                    No hay lineas cargadas.
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
