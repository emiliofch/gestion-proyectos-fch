import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import FilterableTh from './FilterableTh'
import ResizableTh from './ResizableTh'

const FILAS_POR_PAGINA = 10

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]+/g, '')
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function formatPesos(value) {
  if (value === null || value === undefined) return '-'
  return '$' + Number(value).toLocaleString('es-CL')
}

export default function VistaIngresoRealAcumulado() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [proyectos, setProyectos] = useState([])
  const [editandoId, setEditandoId] = useState(null)
  const [editandoValor, setEditandoValor] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState(null)
  const [ordenDir, setOrdenDir] = useState('asc')
  const [pagina, setPagina] = useState(0)

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    supabase.from('proyectos').select('nombre').then(({ data }) => setProyectos(data || []))
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  useEffect(() => { setPagina(0) }, [busqueda, filtros, ordenCol, ordenDir])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('ingreso_real_acumulado').select('*').order('created_at')
    if (error) toast.error('Error al cargar: ' + error.message)
    else setRows(data || [])
    setLoading(false)
  }

  const rowsConProyectos = useMemo(() => {
    return rows.map((row) => {
      const keyRow = normalizeKey(row.nombre)
      const enProyectos = proyectos.some((p) => {
        const keyP = normalizeKey(p.nombre)
        return keyRow.includes(keyP) || keyP.includes(keyRow)
      })
      return { ...row, enProyectos }
    })
  }, [rows, proyectos])

  function setFiltro(col, valor) { setFiltros(prev => ({ ...prev, [col]: valor })) }

  function toggleOrden(col) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
  }

  const filasFiltradas = useMemo(() => {
    let result = rowsConProyectos.filter(row => {
      const q = busqueda.toLowerCase()
      const matchBusqueda = !q || (row.nombre || '').toLowerCase().includes(q)
      const matchNombre = !filtros.nombre?.length || filtros.nombre.includes(row.nombre)
      const matchEnP = !filtros.enProyectos?.length || filtros.enProyectos.includes(row.enProyectos ? 'Sí' : 'No')
      return matchBusqueda && matchNombre && matchEnP
    })
    if (ordenCol) {
      result = [...result].sort((a, b) => {
        if (ordenCol === 'ingreso') {
          const vA = a.ingreso ?? 0, vB = b.ingreso ?? 0
          return ordenDir === 'asc' ? vA - vB : vB - vA
        }
        const vA = String(a[ordenCol] || '').toLowerCase()
        const vB = String(b[ordenCol] || '').toLowerCase()
        return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
      })
    }
    return result
  }, [rowsConProyectos, busqueda, filtros, ordenCol, ordenDir])

  const opcionesPor = (col) => {
    if (col === 'enProyectos') return ['Sí', 'No']
    return [...new Set(rowsConProyectos.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'es'))
  }

  function iniciarEdicion(id, valorActual) {
    setEditandoId(id)
    setEditandoValor(valorActual)
  }

  async function guardarEdicion() {
    const nuevoNombre = editandoValor.trim()
    const id = editandoId
    setEditandoId(null)
    setEditandoValor('')
    if (!nuevoNombre) return
    const { error } = await supabase.from('ingreso_real_acumulado').update({ nombre: nuevoNombre }).eq('id', id)
    if (error) { toast.error('Error al guardar: ' + error.message); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, nombre: nuevoNombre } : r))
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setEditandoValor('')
  }

  function onKeyDownEdicion(e) {
    if (e.key === 'Enter') guardarEdicion()
    if (e.key === 'Escape') cancelarEdicion()
  }

  async function importar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const workbook = XLSX.read(ev.target.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(sheet)
        const parsed = data.map((rawRow) => {
          const norm = {}
          Object.keys(rawRow).forEach(k => { norm[normalizeKey(k)] = rawRow[k] })
          return {
            nombre: String(
              rawRow['nombreProyecto'] ?? rawRow['NombreProyecto'] ??
              norm['nombreproyecto'] ?? norm['nombre_proyecto'] ?? norm['proyecto'] ?? norm['nombre'] ?? ''
            ).trim(),
            ingreso: parseNumber(
              rawRow['IngresoRealAcumulado'] ?? rawRow['ingresoRealAcumulado'] ??
              norm['ingresorrealacumulado'] ?? norm['ingreso_real_acumulado'] ?? norm['ingreso_real'] ?? norm['ingreso'] ?? null
            ) ?? 0,
          }
        }).filter(r => r.nombre)

        if (!parsed.length) { toast.error('No se encontraron filas válidas.'); return }

        const { error: delError } = await supabase.from('ingreso_real_acumulado').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (delError) { toast.error('Error al limpiar tabla: ' + delError.message); return }

        const CHUNK = 200
        for (let i = 0; i < parsed.length; i += CHUNK) {
          const { error } = await supabase.from('ingreso_real_acumulado').insert(parsed.slice(i, i + CHUNK))
          if (error) { toast.error('Error al insertar: ' + error.message); return }
        }

        toast.success(`${parsed.length} filas importadas.`)
        cargar()
      } catch (err) {
        toast.error('Error leyendo Excel: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function exportar() {
    const wsData = [
      ['Nombre Proyecto', 'Ingreso Real Acumulado', 'En Proyectos?'],
      ...filasFiltradas.map(r => [r.nombre, r.ingreso, r.enProyectos ? 'Sí' : 'No']),
      ['TOTAL', filasFiltradas.reduce((a, r) => a + (r.ingreso || 0), 0), ''],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ingreso Real Acumulado')
    XLSX.writeFile(wb, 'ingreso_real_acumulado.xlsx')
  }

  const totalIngreso = filasFiltradas.reduce((a, r) => a + (r.ingreso || 0), 0)
  const filasEnPagina = filasFiltradas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Ingreso Real Acumulado</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <label className="cursor-pointer px-3 py-2 rounded text-white text-sm font-medium" style={{ backgroundColor: '#009ADE' }}>
            Importar Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={importar} />
          </label>
          <button type="button" onClick={exportar} className="px-3 py-2 rounded text-white text-sm font-medium" style={{ backgroundColor: '#86C300' }}>
            Exportar Excel
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        La columna <strong>en proyectos?</strong> indica si el nombre del proyecto coincide con alguno en la tabla de proyectos. Importa un Excel con columnas <code>nombreProyecto</code> e <code>IngresoRealAcumulado</code>.
      </p>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-lg mb-1">Sin datos</p>
          <p className="text-sm">Importa un archivo Excel para comenzar.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <ResizableTh className="py-3 px-3 text-gray-500 font-semibold text-center bg-[#FFF5F0]" style={{ width: '48px' }}>#</ResizableTh>
                  <FilterableTh col="nombre" label="Nombre Proyecto" align="left"
                    opciones={opcionesPor('nombre')} filtro={filtros.nombre || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'nombre'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'nombre'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="ingreso" label="Ingreso Real Acumulado" align="right"
                    opciones={opcionesPor('ingreso')} filtro={filtros.ingreso || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'ingreso'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'ingreso'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="enProyectos" label="en proyectos?" align="center"
                    opciones={opcionesPor('enProyectos')} filtro={filtros.enProyectos || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'enProyectos'} onToggleDropdown={setDropdownFiltro} />
                </tr>
              </thead>
              <tbody>
                {filasEnPagina.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-gray-400">Sin resultados.</td></tr>
                ) : filasEnPagina.map((row, i) => (
                  <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="border border-gray-300 px-2 py-2 text-center text-gray-500">{pagina * FILAS_POR_PAGINA + i + 1}</td>
                    <td
                      className="border border-gray-300 px-3 py-2 text-gray-800 cursor-pointer"
                      onClick={() => iniciarEdicion(row.id, row.nombre)}
                    >
                      {editandoId === row.id ? (
                        <input
                          autoFocus
                          className="w-full px-2 py-0.5 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                          value={editandoValor}
                          onChange={e => setEditandoValor(e.target.value)}
                          onBlur={guardarEdicion}
                          onKeyDown={onKeyDownEdicion}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="hover:underline hover:text-blue-600 transition-colors">{row.nombre}</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-medium text-gray-800">{formatPesos(row.ingreso)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {row.enProyectos
                        ? <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">✓ Sí</span>
                        : <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">✗ No</span>}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td colSpan={2} className="px-3 py-3 text-sm text-gray-800">TOTAL ({filasFiltradas.length})</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-800">{formatPesos(totalIngreso)}</td>
                  <td className="px-3 py-3" />
                </tr>
              </tbody>
            </table>
          </div>

          {filasFiltradas.length > FILAS_POR_PAGINA && (
            <div className="flex justify-between items-center py-2 text-sm text-gray-600">
              <span>{pagina * FILAS_POR_PAGINA + 1}–{Math.min((pagina + 1) * FILAS_POR_PAGINA, filasFiltradas.length)} de {filasFiltradas.length}</span>
              <div className="flex gap-2">
                <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
                <button onClick={() => setPagina(p => p + 1)} disabled={(pagina + 1) * FILAS_POR_PAGINA >= filasFiltradas.length}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
