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

export default function VistaRealAcumulado() {
  const [rowsIng, setRowsIng] = useState([])
  const [rowsGasto, setRowsGasto] = useState([])
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
    const [{ data: ing, error: errIng }, { data: gasto, error: errGasto }] = await Promise.all([
      supabase.from('ingreso_real_acumulado').select('*').order('created_at'),
      supabase.from('gasto_real_acumulado').select('*').order('created_at'),
    ])
    if (errIng) toast.error('Error al cargar ingresos: ' + errIng.message)
    if (errGasto) toast.error('Error al cargar gastos: ' + errGasto.message)
    setRowsIng(ing || [])
    setRowsGasto(gasto || [])
    setLoading(false)
  }

  const rowsMerged = useMemo(() => {
    const ingMap = {}
    const ingNombreMap = {}
    for (const r of rowsIng) {
      const k = normalizeKey(r.nombre)
      if (!k) continue
      ingMap[k] = (ingMap[k] || 0) + (parseFloat(r.ingreso) || 0)
      ingNombreMap[k] = r.nombre
    }
    const gastoMap = {}
    const gastoNombreMap = {}
    for (const r of rowsGasto) {
      const k = normalizeKey(r.nombre)
      if (!k) continue
      gastoMap[k] = (gastoMap[k] || 0) + (parseFloat(r.gasto) || 0)
      gastoNombreMap[k] = r.nombre
    }
    const allKeys = new Set([...Object.keys(ingMap), ...Object.keys(gastoMap)])
    return [...allKeys].map(k => ({
      key: k,
      nombre: ingNombreMap[k] || gastoNombreMap[k] || k,
      ingreso: ingMap[k] || 0,
      gasto: gastoMap[k] || 0,
    }))
  }, [rowsIng, rowsGasto])

  const rowsConProyectos = useMemo(() => {
    return rowsMerged.map(row => {
      const keyRow = normalizeKey(row.nombre)
      const enProyectos = proyectos.some(p => {
        const keyP = normalizeKey(p.nombre)
        return keyRow.includes(keyP) || keyP.includes(keyRow)
      })
      return { ...row, enProyectos }
    })
  }, [rowsMerged, proyectos])

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
        if (ordenCol === 'ingreso' || ordenCol === 'gasto') {
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
    const [{ data: oldIngData }, { data: oldGastoData }] = await Promise.all([
      supabase.from('ingreso_real_acumulado').select('nombre, ingreso'),
      supabase.from('gasto_real_acumulado').select('nombre, gasto'),
    ])

    const oldIngMap = {}
    for (const r of oldIngData || []) {
      const k = normalizeKey(r.nombre)
      if (k) oldIngMap[k] = (oldIngMap[k] || 0) + (parseFloat(r.ingreso) || 0)
    }
    const oldGastoMap = {}
    for (const r of oldGastoData || []) {
      const k = normalizeKey(r.nombre)
      if (k) oldGastoMap[k] = (oldGastoMap[k] || 0) + (parseFloat(r.gasto) || 0)
    }

    const newIngMap = {}
    const newGastoMap = {}
    for (const r of parsed) {
      const k = normalizeKey(r.nombre)
      if (!k) continue
      newIngMap[k] = (newIngMap[k] || 0) + (parseFloat(r.ingreso) || 0)
      newGastoMap[k] = (newGastoMap[k] || 0) + (parseFloat(r.gasto) || 0)
    }

    const { data: proyData } = await supabase.from('proyectos').select('id, nombre, ingresos, gastos')
    const proyMap = {}
    for (const p of proyData || []) {
      const k = normalizeKey(p.nombre)
      if (k) proyMap[k] = p
    }

    const allKeys = new Set([
      ...Object.keys(oldIngMap), ...Object.keys(newIngMap),
      ...Object.keys(oldGastoMap), ...Object.keys(newGastoMap),
    ])
    const ajustes = []
    for (const k of allKeys) {
      const oldIngVal = oldIngMap[k] || 0
      const newIngVal = newIngMap[k] || 0
      const deltaIng = newIngVal - oldIngVal
      const oldGastoVal = oldGastoMap[k] || 0
      const newGastoVal = newGastoMap[k] || 0
      const deltaGasto = newGastoVal - oldGastoVal
      if (deltaIng === 0 && deltaGasto === 0) continue

      const proy = proyMap[k]
      const oldPorIngresar = proy ? (parseFloat(proy.ingresos) || 0) : null
      const newPorIngresar = proy ? oldPorIngresar - deltaIng : null
      const oldPorGastar = proy ? (parseFloat(proy.gastos) || 0) : null
      const newPorGastar = proy ? oldPorGastar - deltaGasto : null

      const nombreDisplay =
        parsed.find(r => normalizeKey(r.nombre) === k)?.nombre ||
        (oldIngData || []).find(r => normalizeKey(r.nombre) === k)?.nombre ||
        (oldGastoData || []).find(r => normalizeKey(r.nombre) === k)?.nombre ||
        k

      ajustes.push({
        nombre: nombreDisplay,
        proyectoNombre: proy?.nombre || null,
        proyectoId: proy?.id || null,
        oldIngVal, newIngVal, deltaIng,
        oldGastoVal, newGastoVal, deltaGasto,
        oldPorIngresar, newPorIngresar,
        oldPorGastar, newPorGastar,
        sinMatch: !proy,
      })
    }

    setPendienteImportacion({ parsed, ajustes })
  }

  async function confirmarImportacion() {
    const { parsed, ajustes } = pendienteImportacion
    setAplicando(true)

    const [{ error: delIngError }, { error: delGastoError }] = await Promise.all([
      supabase.from('ingreso_real_acumulado').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('gasto_real_acumulado').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ])
    if (delIngError) { toast.error('Error limpiando ingresos: ' + delIngError.message); setAplicando(false); return }
    if (delGastoError) { toast.error('Error limpiando gastos: ' + delGastoError.message); setAplicando(false); return }

    const ingRows = parsed
      .filter(r => (parseFloat(r.ingreso) || 0) !== 0)
      .map(r => ({ nombre: r.nombre, ingreso: parseFloat(r.ingreso) || 0 }))
    const gastoRows = parsed
      .filter(r => (parseFloat(r.gasto) || 0) !== 0)
      .map(r => ({ nombre: r.nombre, gasto: parseFloat(r.gasto) || 0 }))

    const CHUNK = 200
    for (let i = 0; i < ingRows.length; i += CHUNK) {
      const { error } = await supabase.from('ingreso_real_acumulado').insert(ingRows.slice(i, i + CHUNK))
      if (error) { toast.error('Error insertando ingresos: ' + error.message); setAplicando(false); return }
    }
    for (let i = 0; i < gastoRows.length; i += CHUNK) {
      const { error } = await supabase.from('gasto_real_acumulado').insert(gastoRows.slice(i, i + CHUNK))
      if (error) { toast.error('Error insertando gastos: ' + error.message); setAplicando(false); return }
    }

    const conMatch = ajustes.filter(a => !a.sinMatch)
    for (const a of conMatch) {
      const updates = {}
      if (a.deltaIng !== 0) updates.ingresos = a.newPorIngresar
      if (a.deltaGasto !== 0) updates.gastos = a.newPorGastar
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('proyectos').update(updates).eq('id', a.proyectoId)
        if (error) toast.error(`Error ajustando ${a.proyectoNombre}: ${error.message}`)
      }
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
              rawRow['nombreProyecto'] ?? rawRow['NombreProyecto'] ?? rawRow['Proyecto'] ?? rawRow['proyecto'] ??
              norm['nombreproyecto'] ?? norm['nombre_proyecto'] ?? norm['proyecto'] ?? norm['nombre'] ?? ''
            ).trim(),
            ingreso: parseNumber(
              rawRow['IngresoRealAcumulado'] ?? rawRow['ingresoRealAcumulado'] ??
              rawRow['Ingreso'] ?? rawRow['ingreso'] ??
              norm['ingresorrealacumulado'] ?? norm['ingreso_real_acumulado'] ?? norm['ingreso_real'] ?? norm['ingreso'] ?? null
            ) ?? 0,
            gasto: parseNumber(
              rawRow['GastoOPReal'] ?? rawRow['gastoOPReal'] ?? rawRow['GastoOpReal'] ??
              rawRow['Gasto'] ?? rawRow['gasto'] ??
              norm['gastoop_real'] ?? norm['gastoopreal'] ?? norm['gasto_op_real'] ?? norm['gasto_real'] ?? norm['gasto'] ?? null
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
      ['nombreProyecto', 'IngresoRealAcumulado', 'GastoOPReal', 'En Proyectos?'],
      ...filasFiltradas.map(r => [r.nombre, r.ingreso, r.gasto, r.enProyectos ? 'Sí' : 'No']),
      ['TOTAL', filasFiltradas.reduce((a, r) => a + (r.ingreso || 0), 0), filasFiltradas.reduce((a, r) => a + (r.gasto || 0), 0), ''],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Real Acumulado')
    XLSX.writeFile(wb, 'real_acumulado.xlsx')
  }

  const totalIngreso = filasFiltradas.reduce((a, r) => a + (r.ingreso || 0), 0)
  const totalGasto = filasFiltradas.reduce((a, r) => a + (r.gasto || 0), 0)
  const filasEnPagina = filasFiltradas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA)

  const haySinMatch = pendienteImportacion?.ajustes.some(a => a.sinMatch)

  return (
    <div>
      {pendienteImportacion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => !aplicando && setPendienteImportacion(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Confirmar ajuste de "Por Ingresar" y "Por Gastar"</h3>
              <p className="text-sm text-gray-500 mt-1">
                Al confirmar, los campos <strong>Por Ingresar</strong> y <strong>Por Gastar</strong> de cada proyecto se ajustarán para mantener los totales constantes.
              </p>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {!haySinMatch ? (
                <div className="text-center py-10 text-gray-500">
                  <p className="font-medium text-green-700">Todos los proyectos tienen match</p>
                  <p className="text-sm mt-1">Se ajustarán "Por Ingresar" y "Por Gastar" automáticamente en {pendienteImportacion.ajustes.filter(a => !a.sinMatch).length} proyectos.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2 mb-4">
                    ⚠ Los siguientes registros no tienen proyecto coincidente en la tabla de proyectos. No ajustarán "Por Ingresar" ni "Por Gastar".
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-gray-300 bg-gray-50">
                          <th className="px-3 py-2 text-left text-gray-600 font-semibold">Nombre en el archivo</th>
                          <th className="px-3 py-2 text-right text-gray-600 font-semibold">Ingreso Real</th>
                          <th className="px-3 py-2 text-right text-gray-600 font-semibold">Gasto Real</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendienteImportacion.ajustes.filter(a => a.sinMatch).map((a, i) => (
                          <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="px-3 py-2 text-gray-800">{a.nombre}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{fmtM(a.newIngVal)}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{fmtM(a.newGastoVal)}</td>
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
        <h2 className="text-2xl font-bold text-gray-800">Ingreso y Gasto Real Acumulado</h2>
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
        Acepta CSV o Excel con columnas <code>nombreProyecto</code>, <code>IngresoRealAcumulado</code> y <code>GastoOPReal</code>. Cada importación reemplaza todos los datos anteriores y ajusta "Por Ingresar" y "Por Gastar" en la tabla de proyectos.
      </p>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : rowsMerged.length === 0 ? (
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
                  <FilterableTh col="ingreso" label="Ingreso Real" align="right"
                    opciones={opcionesPor('ingreso')} filtro={filtros.ingreso || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'ingreso'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'ingreso'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="gasto" label="Gasto Real" align="right"
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
                  <tr><td colSpan={5} className="py-12 text-center text-gray-400">Sin resultados.</td></tr>
                ) : filasEnPagina.map((row, i) => (
                  <tr key={row.key} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="border border-gray-300 px-2 py-2 text-center text-gray-500">{pagina * FILAS_POR_PAGINA + i + 1}</td>
                    <td className="border border-gray-300 px-3 py-2 text-gray-800">{row.nombre}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-medium text-gray-800">{formatPesos(row.ingreso)}</td>
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
                  <td className="px-3 py-3 text-right text-sm text-gray-800">{formatPesos(totalIngreso)}</td>
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
