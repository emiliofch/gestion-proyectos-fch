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

export default function VistaPptoAcumulado() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [proyectos, setProyectos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState(null)
  const [ordenDir, setOrdenDir] = useState('asc')
  const [pagina, setPagina] = useState(0)
  const [pendienteImportacion, setPendienteImportacion] = useState(null)
  const [aplicando, setAplicando] = useState(false)

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
    const { data, error } = await supabase.from('presupuesto_acumulado').select('*').order('created_at')
    if (error) toast.error('Error al cargar datos: ' + error.message)
    setRows(data || [])
    setLoading(false)
  }

  const rowsConProyectos = useMemo(() => {
    return rows.map(row => {
      const keyRow = normalizeKey(row.nombre)
      const enProyectos = proyectos.some(p => {
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
        const numCols = ['ingreso', 'gasto_hh', 'gasto_op', 'margen']
        if (numCols.includes(ordenCol)) {
          const vA = a[ordenCol] ?? 0, vB = b[ordenCol] ?? 0
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

  async function prepararImportacion(parsed) {
    const { data: proyData } = await supabase.from('proyectos').select('nombre')
    const proySet = new Set((proyData || []).map(p => normalizeKey(p.nombre)))

    const ajustes = parsed.map(r => {
      const k = normalizeKey(r.nombre)
      const sinMatch = !proySet.has(k)
      return { ...r, sinMatch }
    })

    setPendienteImportacion({ parsed, ajustes })
  }

  async function confirmarImportacion() {
    const { parsed } = pendienteImportacion
    setAplicando(true)

    const { error: delError } = await supabase
      .from('presupuesto_acumulado')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (delError) { toast.error('Error limpiando datos: ' + delError.message); setAplicando(false); return }

    const insertRows = parsed.map(r => ({
      nombre:   r.nombre,
      ingreso:  r.ingreso  ?? 0,
      gasto_hh: r.gasto_hh ?? 0,
      gasto_op: r.gasto_op ?? 0,
      margen:   r.margen   ?? 0,
    }))

    const CHUNK = 200
    for (let i = 0; i < insertRows.length; i += CHUNK) {
      const { error } = await supabase.from('presupuesto_acumulado').insert(insertRows.slice(i, i + CHUNK))
      if (error) { toast.error('Error insertando datos: ' + error.message); setAplicando(false); return }
    }

    setPendienteImportacion(null)
    setAplicando(false)
    toast.success(`${parsed.length} filas importadas correctamente.`)
    cargar()
  }

  async function importar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const esCsv = file.name.toLowerCase().endsWith('.csv')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const workbook = esCsv
          ? XLSX.read(ev.target.result, { type: 'string' })
          : XLSX.read(ev.target.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(sheet)
        const parsed = data.map((rawRow) => {
          const norm = {}
          Object.keys(rawRow).forEach(k => { norm[normalizeKey(k)] = rawRow[k] })
          return {
            nombre:   String(rawRow['Proyecto'] ?? rawRow['proyecto'] ?? rawRow['nombreProyecto'] ?? norm['proyecto'] ?? norm['nombre'] ?? '').trim(),
            ingreso:  parseNumber(rawRow['Ingreso Ppto'] ?? rawRow['IngresosPpto'] ?? rawRow['Ingreso'] ?? norm['ingreso_ppto'] ?? norm['ingreso'] ?? null) ?? 0,
            gasto_hh: parseNumber(rawRow['Gasto HH Ppto'] ?? rawRow['GastoHHPpto'] ?? rawRow['GastoHH'] ?? norm['gasto_hh_ppto'] ?? norm['gasto_hh'] ?? null) ?? 0,
            gasto_op: parseNumber(rawRow['Gasto OP Ppto'] ?? rawRow['GastoOPPpto'] ?? rawRow['GastoOP'] ?? norm['gasto_op_ppto'] ?? norm['gasto_op'] ?? null) ?? 0,
            margen:   parseNumber(rawRow['Margen Ppto'] ?? rawRow['MargenPpto'] ?? rawRow['Margen'] ?? norm['margen_ppto'] ?? norm['margen'] ?? null) ?? 0,
          }
        }).filter(r => r.nombre)

        if (!parsed.length) { toast.error('No se encontraron filas válidas.'); return }
        await prepararImportacion(parsed)
      } catch (err) {
        toast.error('Error leyendo archivo: ' + err.message)
      }
    }
    esCsv ? reader.readAsText(file, 'UTF-8') : reader.readAsArrayBuffer(file)
  }

  function exportar() {
    const wsData = [
      ['Proyecto', 'Ingreso Ppto', 'Gasto HH Ppto', 'Gasto OP Ppto', 'Margen Ppto', 'En Proyectos?'],
      ...filasFiltradas.map(r => [r.nombre, r.ingreso, r.gasto_hh, r.gasto_op, r.margen, r.enProyectos ? 'Sí' : 'No']),
      ['TOTAL',
        filasFiltradas.reduce((a, r) => a + (r.ingreso || 0), 0),
        filasFiltradas.reduce((a, r) => a + (r.gasto_hh || 0), 0),
        filasFiltradas.reduce((a, r) => a + (r.gasto_op || 0), 0),
        filasFiltradas.reduce((a, r) => a + (r.margen || 0), 0),
        '',
      ],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ppto Acumulado')
    XLSX.writeFile(wb, 'presupuesto_acumulado.xlsx')
  }

  const totales = useMemo(() => ({
    ingreso:  filasFiltradas.reduce((a, r) => a + (r.ingreso  || 0), 0),
    gasto_hh: filasFiltradas.reduce((a, r) => a + (r.gasto_hh || 0), 0),
    gasto_op: filasFiltradas.reduce((a, r) => a + (r.gasto_op || 0), 0),
    margen:   filasFiltradas.reduce((a, r) => a + (r.margen   || 0), 0),
  }), [filasFiltradas])

  const filasEnPagina = filasFiltradas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA)
  const haySinMatch = pendienteImportacion?.ajustes.some(a => a.sinMatch)

  return (
    <div>
      {pendienteImportacion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => !aplicando && setPendienteImportacion(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Confirmar importación</h3>
              <p className="text-sm text-gray-500 mt-1">{pendienteImportacion.parsed.length} filas a importar. Reemplaza todos los datos anteriores.</p>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {!haySinMatch ? (
                <div className="text-center py-10 text-gray-500">
                  <p className="font-medium text-green-700">Todos los proyectos tienen match</p>
                  <p className="text-sm mt-1">Se importarán {pendienteImportacion.parsed.length} filas sin conflictos.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2 mb-4">
                    ⚠ Los siguientes registros no tienen proyecto coincidente en la tabla de proyectos.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-gray-300 bg-gray-50">
                          <th className="px-3 py-2 text-left text-gray-600 font-semibold">Nombre en el archivo</th>
                          <th className="px-3 py-2 text-right text-gray-600 font-semibold">Ingreso Ppto</th>
                          <th className="px-3 py-2 text-right text-gray-600 font-semibold">Gasto HH Ppto</th>
                          <th className="px-3 py-2 text-right text-gray-600 font-semibold">Gasto OP Ppto</th>
                          <th className="px-3 py-2 text-right text-gray-600 font-semibold">Margen Ppto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendienteImportacion.ajustes.filter(a => a.sinMatch).map((a, i) => (
                          <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="px-3 py-2 text-gray-800">{a.nombre}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{formatPesos(a.ingreso)}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{formatPesos(a.gasto_hh)}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{formatPesos(a.gasto_op)}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{formatPesos(a.margen)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
              <span className="text-xs text-gray-400">
                {pendienteImportacion.ajustes.filter(a => a.sinMatch).length} sin match
              </span>
              <div className="flex gap-3">
                <button type="button" onClick={() => setPendienteImportacion(null)} disabled={aplicando}
                  className="px-4 py-2 text-sm rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                  Cancelar
                </button>
                <button type="button" onClick={confirmarImportacion} disabled={aplicando}
                  className="px-4 py-2 text-sm rounded text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: '#FF5100' }}>
                  {aplicando ? 'Importando...' : 'Confirmar y aplicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Presupuesto Acumulado a la Fecha</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar proyecto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <label className="cursor-pointer px-3 py-2 rounded text-white text-sm font-medium" style={{ backgroundColor: '#009ADE' }}>
            Importar
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importar} />
          </label>
          <button type="button" onClick={exportar} className="px-3 py-2 rounded text-white text-sm font-medium" style={{ backgroundColor: '#86C300' }}>
            Exportar Excel
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Acepta CSV o Excel con columnas <code>Proyecto</code>, <code>Ingreso Ppto</code>, <code>Gasto HH Ppto</code>, <code>Gasto OP Ppto</code>, <code>Margen Ppto</code>. Cada importación reemplaza todos los datos anteriores.
      </p>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-lg mb-1">Sin datos</p>
          <p className="text-sm">Importa un archivo Excel o CSV para comenzar.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <ResizableTh className="py-3 px-3 text-gray-500 font-semibold text-center bg-[#FFF5F0]" style={{ width: '48px' }}>#</ResizableTh>
                  <FilterableTh col="nombre" label="Proyecto" align="left"
                    opciones={opcionesPor('nombre')} filtro={filtros.nombre || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'nombre'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'nombre'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="ingreso" label="Ingreso Ppto" align="right"
                    opciones={opcionesPor('ingreso')} filtro={filtros.ingreso || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'ingreso'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'ingreso'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="gasto_hh" label="Gasto HH Ppto" align="right"
                    opciones={opcionesPor('gasto_hh')} filtro={filtros.gasto_hh || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'gasto_hh'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'gasto_hh'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="gasto_op" label="Gasto OP Ppto" align="right"
                    opciones={opcionesPor('gasto_op')} filtro={filtros.gasto_op || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'gasto_op'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'gasto_op'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="margen" label="Margen Ppto" align="right"
                    opciones={opcionesPor('margen')} filtro={filtros.margen || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'margen'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'margen'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="enProyectos" label="en proyectos?" align="center"
                    opciones={opcionesPor('enProyectos')} filtro={filtros.enProyectos || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'enProyectos'} onToggleDropdown={setDropdownFiltro} />
                </tr>
              </thead>
              <tbody>
                {filasEnPagina.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">Sin resultados.</td></tr>
                ) : filasEnPagina.map((row, i) => (
                  <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="border border-gray-300 px-2 py-2 text-center text-gray-500">{pagina * FILAS_POR_PAGINA + i + 1}</td>
                    <td className="border border-gray-300 px-3 py-2 text-gray-800">{row.nombre}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-medium text-gray-800">{formatPesos(row.ingreso)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-medium text-gray-800">{formatPesos(row.gasto_hh)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-medium text-gray-800">{formatPesos(row.gasto_op)}</td>
                    <td className={`border border-gray-300 px-3 py-2 text-right font-medium ${(row.margen || 0) < 0 ? 'text-red-600' : 'text-gray-800'}`}>{formatPesos(row.margen)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {row.enProyectos
                        ? <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">✓ Sí</span>
                        : <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">✗ No</span>}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td colSpan={2} className="px-3 py-3 text-sm text-gray-800">TOTAL ({filasFiltradas.length})</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-800">{formatPesos(totales.ingreso)}</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-800">{formatPesos(totales.gasto_hh)}</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-800">{formatPesos(totales.gasto_op)}</td>
                  <td className={`px-3 py-3 text-right text-sm font-bold ${totales.margen < 0 ? 'text-red-600' : 'text-gray-800'}`}>{formatPesos(totales.margen)}</td>
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
