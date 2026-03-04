import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import FilterableTh from './FilterableTh'

function buildTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

function toMonthInput(fecha) {
  return String(fecha || '').slice(0, 7)
}

function mesActualIso() {
  return new Date().toISOString().slice(0, 7)
}

export default function VistaIngresoHHAdmin({ perfil }) {
  const [mes, setMes] = useState(mesActualIso())
  const [loading, setLoading] = useState(true)
  const [registros, setRegistros] = useState([])
  const [usuariosMap, setUsuariosMap] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('mes')
  const [ordenDir, setOrdenDir] = useState('desc')

  useEffect(() => {
    cargarDatos()
  }, [mes, perfil?.empresa])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  async function cargarDatos() {
    setLoading(true)
    const mesDb = `${mes}-01`

    let query = supabase
      .from('ingreso_hh')
      .select('id, user_id, proyecto_id, horas, mes, empresa, proyectos:proyecto_id(nombre)')
      .eq('mes', mesDb)
      .order('created_at', { ascending: true })

    if (perfil?.empresa) query = query.eq('empresa', perfil.empresa)

    const { data, error } = await query
    if (error) {
      toast.error('Error cargando HH: ' + error.message)
      setRegistros([])
      setLoading(false)
      return
    }

    const rows = data || []
    setRegistros(rows)

    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]
    if (userIds.length === 0) {
      setUsuariosMap({})
      setLoading(false)
      return
    }

    const { data: perfilesData } = await supabase
      .from('perfiles')
      .select('id, email')
      .in('id', userIds)

    const map = {}
    for (const p of (perfilesData || [])) {
      map[p.id] = p.email || p.id
    }
    setUsuariosMap(map)
    setLoading(false)
  }

  function coincideFiltros(r, omitirCol = null) {
    const usuario = usuariosMap[r.user_id] || r.user_id || ''
    const proyecto = r.proyectos?.nombre || ''
    const matchUsuario = omitirCol === 'usuario' || !filtros.usuario?.length || filtros.usuario.includes(usuario)
    const matchProyecto = omitirCol === 'proyecto' || !filtros.proyecto?.length || filtros.proyecto.includes(proyecto)
    const matchEmpresa = omitirCol === 'empresa' || !filtros.empresa?.length || filtros.empresa.includes(r.empresa || '')
    return matchUsuario && matchProyecto && matchEmpresa
  }

  function opcionesPorColumna(col, obtenerValor) {
    const visibles = registros.filter((r) => coincideFiltros(r, col))
    const base = visibles.map(obtenerValor).filter(Boolean)
    const seleccionadas = Array.isArray(filtros[col]) ? filtros[col] : []
    return [...new Set([...base, ...seleccionadas])].sort((a, b) => String(a).localeCompare(String(b), 'es'))
  }

  const opcionesUsuario = opcionesPorColumna('usuario', (r) => usuariosMap[r.user_id] || r.user_id)
  const opcionesProyecto = opcionesPorColumna('proyecto', (r) => r.proyectos?.nombre)
  const opcionesEmpresa = opcionesPorColumna('empresa', (r) => r.empresa)

  const registrosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return registros.filter((r) => {
      const usuario = (usuariosMap[r.user_id] || r.user_id || '').toLowerCase()
      const proyecto = (r.proyectos?.nombre || '').toLowerCase()
      const matchBusqueda = !q || usuario.includes(q) || proyecto.includes(q)
      return matchBusqueda && coincideFiltros(r)
    }).sort((a, b) => {
      let vA = ''
      let vB = ''
      if (ordenCol === 'mes') { vA = new Date(a.mes).getTime() || 0; vB = new Date(b.mes).getTime() || 0 }
      if (ordenCol === 'usuario') { vA = usuariosMap[a.user_id] || a.user_id || ''; vB = usuariosMap[b.user_id] || b.user_id || '' }
      if (ordenCol === 'proyecto') { vA = a.proyectos?.nombre || ''; vB = b.proyectos?.nombre || '' }
      if (ordenCol === 'horas') { vA = Number(a.horas) || 0; vB = Number(b.horas) || 0 }
      if (ordenCol === 'empresa') { vA = a.empresa || ''; vB = b.empresa || '' }
      if (typeof vA === 'string') return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
      return ordenDir === 'asc' ? vA - vB : vB - vA
    })
  }, [registros, usuariosMap, busqueda, filtros, ordenCol, ordenDir])

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

  const totalHoras = useMemo(
    () => Number(registrosFiltrados.reduce((acc, r) => acc + (Number(r.horas) || 0), 0).toFixed(2)),
    [registrosFiltrados],
  )

  function exportarExcel() {
    const filas = registrosFiltrados.map((r) => ({
      MES: toMonthInput(r.mes),
      USUARIO: usuariosMap[r.user_id] || r.user_id,
      PROYECTO: r.proyectos?.nombre || '',
      HORAS: Number(r.horas) || 0,
      EMPRESA: r.empresa || '',
    }))

    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'IngresoHH')
    XLSX.writeFile(wb, `ingreso_hh_${mes}_${buildTimestamp()}.xlsx`)
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">HH Cargadas (Admin)</h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <input
            type="text"
            placeholder="Buscar usuario/proyecto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={exportarExcel}
            disabled={registrosFiltrados.length === 0}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#6366F1' }}
          >
            Descargar Planilla
          </button>
        </div>
      </div>

      <div className="mb-3 text-sm text-gray-700">
        Registros: <strong>{registrosFiltrados.length}</strong> | Total horas: <strong>{totalHoras}</strong>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando HH cargadas...</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                <FilterableTh
                  col="mes"
                  label="Mes"
                  opciones={[]}
                  filtro={[]}
                  onFiltro={() => {}}
                  dropdownAbierto={false}
                  onToggleDropdown={() => {}}
                  sortable
                  ordenActiva={ordenCol === 'mes'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="usuario"
                  label="Usuario"
                  opciones={opcionesUsuario}
                  filtro={filtros.usuario || []}
                  onFiltro={setFiltro}
                  dropdownAbierto={dropdownFiltro === 'usuario'}
                  onToggleDropdown={setDropdownFiltro}
                  sortable
                  ordenActiva={ordenCol === 'usuario'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="proyecto"
                  label="Proyecto"
                  opciones={opcionesProyecto}
                  filtro={filtros.proyecto || []}
                  onFiltro={setFiltro}
                  dropdownAbierto={dropdownFiltro === 'proyecto'}
                  onToggleDropdown={setDropdownFiltro}
                  sortable
                  ordenActiva={ordenCol === 'proyecto'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="horas"
                  label="Horas"
                  align="right"
                  opciones={[]}
                  filtro={[]}
                  onFiltro={() => {}}
                  dropdownAbierto={false}
                  onToggleDropdown={() => {}}
                  sortable
                  ordenActiva={ordenCol === 'horas'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="empresa"
                  label="Empresa"
                  opciones={opcionesEmpresa}
                  filtro={filtros.empresa || []}
                  onFiltro={setFiltro}
                  dropdownAbierto={dropdownFiltro === 'empresa'}
                  onToggleDropdown={setDropdownFiltro}
                  sortable
                  ordenActiva={ordenCol === 'empresa'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.map((r) => (
                <tr key={r.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-3 px-4 text-gray-700">{toMonthInput(r.mes)}</td>
                  <td className="py-3 px-4 text-gray-800">{usuariosMap[r.user_id] || r.user_id}</td>
                  <td className="py-3 px-4 text-gray-800">{r.proyectos?.nombre || '-'}</td>
                  <td className="py-3 px-4 text-right text-gray-800">{Number(r.horas) || 0}</td>
                  <td className="py-3 px-4 text-gray-700">{r.empresa || '-'}</td>
                </tr>
              ))}
              {registrosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 px-4 text-center text-gray-500">
                    No hay registros para este mes.
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
