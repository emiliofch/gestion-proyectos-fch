import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import FilterableTh from './FilterableTh'
import ResizableTh from './ResizableTh'
import { aplicarTraspaso, recuperarCrudos } from '../utils/traspasoMargen'

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

function fmtM(value) {
  if (value === null || value === undefined) return '-'
  const m = Number(value) / 1_000_000
  return '$' + Math.abs(m).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M'
}

function fmtDelta(value) {
  const m = Number(value) / 1_000_000
  const sign = m > 0 ? '+' : ''
  return sign + '$' + m.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M'
}

export default function VistaGastoRealAcumulado() {
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
    const { data, error } = await supabase.from('gasto_real_acumulado').select('*').order('created_at')
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
        if (ordenCol === 'gasto') {
          const vA = a.gasto ?? 0, vB = b.gasto ?? 0
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
    const { error } = await supabase.from('gasto_real_acumulado').update({ nombre: nuevoNombre }).eq('id', id)
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

  async function prepararImportacion(parsed) {
    const { data: oldData } = await supabase.from('gasto_real_acumulado').select('nombre, gasto')
    const oldMap = {}
    for (const r of oldData || []) {
      const k = normalizeKey(r.nombre)
      if (k) oldMap[k] = (oldMap[k] || 0) + (parseFloat(r.gasto) || 0)
    }

    const newMap = {}
    for (const r of parsed) {
      const k = normalizeKey(r.nombre)
      if (k) newMap[k] = (newMap[k] || 0) + (parseFloat(r.gasto) || 0)
    }

    const { data: proyData } = await supabase.from('proyectos').select('id, nombre, ingresos, gastos, traspaso_margen')
    const proyMap = {}
    for (const p of proyData || []) {
      const k = normalizeKey(p.nombre)
      if (k) proyMap[k] = p
    }

    const allKeys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)])
    const ajustes = []
    for (const k of allKeys) {
      const oldReal = oldMap[k] || 0
      const newReal = newMap[k] || 0
      const delta = newReal - oldReal
      if (delta === 0) continue

      const proy = proyMap[k]
      const nombreDisplay = parsed.find(r => normalizeKey(r.nombre) === k)?.nombre
        || (oldData || []).find(r => normalizeKey(r.nombre) === k)?.nombre
        || k

      if (!proy) {
        ajustes.push({
          nombre: nombreDisplay, proyectoNombre: null, proyectoId: null,
          oldReal, newReal, delta,
          oldPorIngresar: null, newPorIngresar: null,
          oldPorGastar: null, newPorGastar: null, traspaso: 0,
          sinMatch: true,
        })
        continue
      }

      // Deshago el traslado previo, aplico el delta del real al lado de gasto,
      // y recalculo el traslado para que ningún lado quede negativo (margen intacto).
      const oldPorIngresar = parseFloat(proy.ingresos) || 0
      const oldPorGastar = parseFloat(proy.gastos) || 0
      const { rawIngresar, rawGastar } = recuperarCrudos(oldPorIngresar, oldPorGastar, parseFloat(proy.traspaso_margen) || 0)
      const { porIngresar, porGastar, traspaso } = aplicarTraspaso(rawIngresar, rawGastar - delta)

      ajustes.push({
        nombre: nombreDisplay,
        proyectoNombre: proy.nombre,
        proyectoId: proy.id,
        oldReal, newReal, delta,
        oldPorIngresar, newPorIngresar: porIngresar,
        oldPorGastar, newPorGastar: porGastar,
        traspaso,
        sinMatch: false,
      })
    }

    setPendienteImportacion({ parsed, ajustes })
  }

  async function confirmarImportacion() {
    const { parsed, ajustes } = pendienteImportacion
    setAplicando(true)

    const { error: delError } = await supabase.from('gasto_real_acumulado').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (delError) { toast.error('Error al limpiar tabla: ' + delError.message); setAplicando(false); return }

    const CHUNK = 200
    for (let i = 0; i < parsed.length; i += CHUNK) {
      const { error } = await supabase.from('gasto_real_acumulado').insert(parsed.slice(i, i + CHUNK))
      if (error) { toast.error('Error al insertar: ' + error.message); setAplicando(false); return }
    }

    const conMatch = ajustes.filter(a => !a.sinMatch)
    for (const a of conMatch) {
      const { error } = await supabase.from('proyectos').update({
        ingresos: a.newPorIngresar,
        gastos: a.newPorGastar,
        traspaso_margen: a.traspaso,
      }).eq('id', a.proyectoId)
      if (error) toast.error(`Error ajustando ${a.proyectoNombre}: ${error.message}`)
    }

    setPendienteImportacion(null)
    setAplicando(false)
    toast.success(`${parsed.length} filas importadas. ${conMatch.length} proyectos ajustados.`)
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
            nombre: String(
              rawRow['nombreProyecto'] ?? rawRow['NombreProyecto'] ??
              norm['nombreproyecto'] ?? norm['nombre_proyecto'] ?? norm['proyecto'] ?? norm['nombre'] ?? ''
            ).trim(),
            gasto: parseNumber(
              rawRow['GastoOPReal'] ??
              rawRow['GastoRealAcumulado'] ?? rawRow['gastoRealAcumulado'] ??
              norm['gastooopreal'] ?? norm['gastoopreal'] ?? norm['gastorealacumulado'] ?? norm['gasto_real'] ?? norm['gasto'] ?? null
            ) ?? 0,
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
      ['Nombre Proyecto', 'Gasto Real Acumulado', 'En Proyectos?'],
      ...filasFiltradas.map(r => [r.nombre, r.gasto, r.enProyectos ? 'Sí' : 'No']),
      ['TOTAL', filasFiltradas.reduce((a, r) => a + (r.gasto || 0), 0), ''],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Gasto Real Acumulado')
    XLSX.writeFile(wb, 'gasto_real_acumulado.xlsx')
  }

  const totalGasto = filasFiltradas.reduce((a, r) => a + (r.gasto || 0), 0)
  const filasEnPagina = filasFiltradas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA)

  const hayTraslados = pendienteImportacion?.ajustes.some(a => !a.sinMatch && a.traspaso !== 0)
  const haySinMatch = pendienteImportacion?.ajustes.some(a => a.sinMatch)

  return (
    <div>
      {/* Modal confirmación */}
      {pendienteImportacion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => !aplicando && setPendienteImportacion(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Confirmar ajuste de "Por Gastar"</h3>
              <p className="text-sm text-gray-500 mt-1">
                Al confirmar se ajusta <strong>Por Gastar</strong> de cada proyecto. Si quedara negativo, el monto se <strong>traslada a "Por Ingresar"</strong> como positivo para que el <strong>margen no cambie</strong>.
              </p>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {pendienteImportacion.ajustes.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <p className="font-medium">Sin cambios en "Por Gastar"</p>
                  <p className="text-sm mt-1">Ningún proyecto cambia su gasto real. Solo se reemplazará la tabla.</p>
                </div>
              ) : (
                <>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300 bg-gray-50">
                        <th className="px-3 py-2 text-left text-gray-600 font-semibold">Proyecto</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-semibold">Real anterior</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-semibold">Real nuevo</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-semibold">Δ</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-semibold">Por Ingresar nuevo</th>
                        <th className="px-3 py-2 text-right text-gray-600 font-semibold">Por Gastar nuevo</th>
                        <th className="px-3 py-2 text-center text-gray-600 font-semibold w-40">Traslado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendienteImportacion.ajustes.map((a, i) => (
                        <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-3 py-2 text-gray-800 max-w-[220px]">
                            <span className="block truncate" title={a.proyectoNombre || a.nombre}>
                              {a.proyectoNombre || a.nombre}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500">{fmtM(a.oldReal)}</td>
                          <td className="px-3 py-2 text-right text-gray-800 font-medium">{fmtM(a.newReal)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${a.delta > 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {fmtDelta(a.delta)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-800">
                            {a.sinMatch ? <span className="text-gray-300">—</span> : fmtM(a.newPorIngresar)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-800">
                            {a.sinMatch ? <span className="text-gray-300">—</span> : fmtM(a.newPorGastar)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {a.sinMatch
                              ? <span className="text-orange-500 font-medium">Sin match</span>
                              : a.traspaso !== 0
                                ? <span className="text-blue-600 font-medium" title={a.traspaso > 0 ? 'El negativo venía de Por Ingresar' : 'El negativo venía de Por Gastar'}>↔ {fmtM(Math.abs(a.traspaso))} {a.traspaso > 0 ? 'a Por Gastar' : 'a Por Ingresar'}</span>
                                : <span className="text-green-600">✓</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {hayTraslados && (
                    <p className="mt-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
                      ↔ En algunos proyectos el gasto real superó el estimado: el excedente se traslada a "Por Ingresar" como positivo para no dejar negativos. El margen no cambia.
                    </p>
                  )}
                  {haySinMatch && (
                    <p className="mt-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                      ⚠ Algunos registros no tienen proyecto coincidente en la tabla de proyectos y no ajustarán "Por Gastar".
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
              <span className="text-xs text-gray-400">
                {pendienteImportacion.parsed.length} filas · {pendienteImportacion.ajustes.filter(a => !a.sinMatch).length} proyectos a ajustar
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPendienteImportacion(null)}
                  disabled={aplicando}
                  className="px-4 py-2 text-sm rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarImportacion}
                  disabled={aplicando}
                  className="px-4 py-2 text-sm rounded text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: '#FF5100' }}
                >
                  {aplicando ? 'Aplicando...' : 'Confirmar y aplicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gasto Real Acumulado</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar..."
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
        Acepta CSV o Excel. El CSV debe tener columnas <code>nombreProyecto</code> y <code>GastoOPReal</code>. Cada importación reemplaza todos los datos anteriores y ajusta automáticamente "Por Gastar" en la tabla de proyectos.
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
                  <FilterableTh col="gasto" label="Gasto Real Acumulado" align="right"
                    opciones={opcionesPor('gasto')} filtro={filtros.gasto || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'gasto'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'gasto'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
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
                    <td className="border border-gray-300 px-3 py-2 text-right font-medium text-gray-800">{formatPesos(row.gasto)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {row.enProyectos
                        ? <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">✓ Sí</span>
                        : <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">✗ No</span>}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td colSpan={2} className="px-3 py-3 text-sm text-gray-800">TOTAL ({filasFiltradas.length})</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-800">{formatPesos(totalGasto)}</td>
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
