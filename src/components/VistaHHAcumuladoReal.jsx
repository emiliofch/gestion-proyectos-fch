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

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function parseMes(val) {
  if (typeof val === 'number' && val > 40000) {
    const d = new Date((val - 25569) * 86400 * 1000)
    return MESES_ES[d.getUTCMonth()] + '-' + String(d.getUTCFullYear()).slice(2)
  }
  return String(val ?? '').trim()
}

function parseMesAnioMes(val) {
  const n = Number(val)
  if (Number.isFinite(n) && n >= 190001 && n <= 209912) {
    const m = n % 100
    const y = Math.floor(n / 100)
    if (m >= 1 && m <= 12) return MESES_ES[m - 1] + '-' + String(y).slice(2)
  }
  return parseMes(val)
}

function mesANum(m) {
  if (!m) return 0
  const [abrev, anio] = m.split('-')
  const idx = MESES_ES.indexOf((abrev || '').toLowerCase())
  const anioFull = parseInt(anio || 0) + (parseInt(anio || 0) < 100 ? 2000 : 0)
  return anioFull * 100 + (idx + 1)
}

function dbToRow(r) {
  return { id: r.id, nombre: r.nombre, nombreProyecto: r.nombre_proyecto, montoHHReal: r.monto_hh_real, mes: r.mes }
}

export default function VistaHHAcumuladoReal() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [proyectos, setProyectos] = useState([])
  const [proyectosLinea, setProyectosLinea] = useState({})
  const [colaboradores, setColaboradores] = useState([])
  const [editandoId, setEditandoId] = useState(null)
  const [editandoCol, setEditandoCol] = useState(null)
  const [editandoValor, setEditandoValor] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState(null)
  const [ordenDir, setOrdenDir] = useState('asc')
  const [pagina, setPagina] = useState(0)

  // pivot colaborador
  const [busquedaColabPivot, setBusquedaColabPivot] = useState('')
  const [filtrosColabPivot, setFiltrosColabPivot] = useState({})
  const [dropdownFiltroColabPivot, setDropdownFiltroColabPivot] = useState(null)
  const [paginaColabPivot, setPaginaColabPivot] = useState(0)

  // pivot línea
  const [busquedaLineaPivot, setBusquedaLineaPivot] = useState('')
  const [filtrosLineaPivot, setFiltrosLineaPivot] = useState({})
  const [dropdownFiltroLineaPivot, setDropdownFiltroLineaPivot] = useState(null)
  const [paginaLineaPivot, setPaginaLineaPivot] = useState(0)

  // pivot detalle colaborador × proyecto
  const [busquedaDetallePivot, setBusquedaDetallePivot] = useState('')
  const [filtrosDetallePivot, setFiltrosDetallePivot] = useState({})
  const [dropdownFiltroDetallePivot, setDropdownFiltroDetallePivot] = useState(null)
  const [paginaDetallePivot, setPaginaDetallePivot] = useState(0)

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    supabase.from('proyectos').select('nombre, ceco').then(({ data }) => {
      setProyectos(data || [])
      const lineasMap = {}
      for (const p of (data || [])) lineasMap[normalizeKey(p.nombre)] = p.ceco || ''
      setProyectosLinea(lineasMap)
    })
    supabase.from('colaboradores').select('colaborador').then(({ data }) => setColaboradores(data || []))
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  useEffect(() => {
    if (!dropdownFiltroColabPivot) return
    function cerrar() { setDropdownFiltroColabPivot(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltroColabPivot])

  useEffect(() => {
    if (!dropdownFiltroLineaPivot) return
    function cerrar() { setDropdownFiltroLineaPivot(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltroLineaPivot])

  useEffect(() => {
    if (!dropdownFiltroDetallePivot) return
    function cerrar() { setDropdownFiltroDetallePivot(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltroDetallePivot])

  useEffect(() => { setPagina(0) }, [busqueda, filtros, ordenCol, ordenDir])
  useEffect(() => { setPaginaColabPivot(0) }, [busquedaColabPivot, filtrosColabPivot])
  useEffect(() => { setPaginaLineaPivot(0) }, [busquedaLineaPivot, filtrosLineaPivot])
  useEffect(() => { setPaginaDetallePivot(0) }, [busquedaDetallePivot, filtrosDetallePivot])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('hh_acumulado_real').select('*').order('created_at')
    if (error) toast.error('Error al cargar: ' + error.message)
    else setRows((data || []).map(dbToRow))
    setLoading(false)
  }

  // Meses cubiertos: distinct mes values sorted chronologically
  const mesesCubiertos = useMemo(() => {
    const distinct = [...new Set(rows.map(r => r.mes).filter(Boolean))]
    return distinct.sort((a, b) => mesANum(a) - mesANum(b))
  }, [rows])

  const rowsConProyectos = useMemo(() => {
    return rows.map((row) => {
      const keyNombreProyecto = normalizeKey(row.nombreProyecto)
      const enProyectos = keyNombreProyecto
        ? proyectos.some((p) => normalizeKey(p.nombre) === keyNombreProyecto)
        : false
      const keyNombre = normalizeKey(row.nombre)
      const enColaboradores = keyNombre
        ? colaboradores.some((c) => normalizeKey(c.colaborador) === keyNombre)
        : false
      return { ...row, enProyectos, enColaboradores }
    })
  }, [rows, proyectos, colaboradores])

  function setFiltro(col, valor) { setFiltros(prev => ({ ...prev, [col]: valor })) }
  function setFiltroColabPivot(col, valor) { setFiltrosColabPivot(prev => ({ ...prev, [col]: valor })) }
  function setFiltroLineaPivot(col, valor) { setFiltrosLineaPivot(prev => ({ ...prev, [col]: valor })) }
  function setFiltroDetallePivot(col, valor) { setFiltrosDetallePivot(prev => ({ ...prev, [col]: valor })) }

  function toggleOrden(col) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
  }

  const filasFiltradas = useMemo(() => {
    let result = rowsConProyectos.filter(row => {
      const q = busqueda.toLowerCase()
      const matchBusqueda = !q || [row.nombre, row.nombreProyecto, row.mes].some(v => (v || '').toLowerCase().includes(q))
      const matchNombre = !filtros.nombre?.length || filtros.nombre.includes(row.nombre)
      const matchProyecto = !filtros.nombreProyecto?.length || filtros.nombreProyecto.includes(row.nombreProyecto)
      const matchMes = !filtros.mes?.length || filtros.mes.includes(row.mes)
      const matchEnP = !filtros.enProyectos?.length || filtros.enProyectos.includes(row.enProyectos ? 'Sí' : 'No')
      const matchEnC = !filtros.enColaboradores?.length || filtros.enColaboradores.includes(row.enColaboradores ? 'Sí' : 'No')
      return matchBusqueda && matchNombre && matchProyecto && matchMes && matchEnP && matchEnC
    })
    if (ordenCol) {
      result = [...result].sort((a, b) => {
        if (ordenCol === 'montoHHReal') {
          const vA = a.montoHHReal ?? 0, vB = b.montoHHReal ?? 0
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
    if (col === 'enProyectos' || col === 'enColaboradores') return ['Sí', 'No']
    return [...new Set(rowsConProyectos.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'es'))
  }

  function iniciarEdicion(id, col, valorActual) {
    setEditandoId(id)
    setEditandoCol(col)
    setEditandoValor(String(valorActual ?? ''))
  }

  async function guardarEdicion() {
    const valor = editandoValor.trim()
    const id = editandoId
    const col = editandoCol
    setEditandoId(null)
    setEditandoCol(null)
    setEditandoValor('')
    if (!valor) return

    const colDb = col === 'nombreProyecto' ? 'nombre_proyecto' : col === 'montoHHReal' ? 'monto_hh_real' : col
    let valorFinal = valor
    if (col === 'montoHHReal') {
      const num = parseNumber(valor)
      if (num === null) return
      valorFinal = num
    }

    const { error } = await supabase.from('hh_acumulado_real').update({ [colDb]: valorFinal }).eq('id', id)
    if (error) { toast.error('Error al guardar: ' + error.message); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, [col]: valorFinal } : r))
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setEditandoCol(null)
    setEditandoValor('')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') guardarEdicion()
    if (e.key === 'Escape') cancelarEdicion()
  }

  function renderCelda(row, col, align = 'left', className = '') {
    const editando = editandoId === row.id && editandoCol === col
    const valor = row[col]
    return (
      <td
        key={col}
        className={`border border-gray-300 px-3 py-2 cursor-pointer ${className}`}
        onClick={() => iniciarEdicion(row.id, col, valor)}
      >
        {editando ? (
          <input
            autoFocus
            className={`w-full px-2 py-0.5 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm text-${align}`}
            value={editandoValor}
            onChange={e => setEditandoValor(e.target.value)}
            onBlur={guardarEdicion}
            onKeyDown={onKeyDown}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={`block text-${align} hover:underline hover:text-blue-600 transition-colors`}>
            {col === 'montoHHReal' ? formatPesos(valor) : (valor || <span className="text-gray-400 italic">—</span>)}
          </span>
        )}
      </td>
    )
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
            nombre: String(rawRow['nombre'] ?? norm['nombre'] ?? '').trim(),
            nombre_proyecto: String(
              rawRow['nombreProyecto'] ?? rawRow['NombreProyecto'] ??
              norm['nombreproyecto'] ?? norm['nombre_proyecto'] ?? ''
            ).trim(),
            monto_hh_real: parseNumber(
              rawRow['MontoHHReal'] ?? rawRow[' MontoHHReal '] ?? rawRow['montoHHReal'] ??
              norm['montohhreal'] ?? norm['montohreal'] ?? norm['monto_hh_real'] ?? norm['montohh'] ?? null
            ) ?? 0,
            mes: parseMesAnioMes(
              rawRow['añoMes'] ?? rawRow['anioMes'] ?? rawRow['AnoMes'] ?? norm['anomes'] ??
              rawRow['mes'] ?? rawRow['Mes'] ?? norm['mes'] ?? ''
            ),
          }
        }).filter(r => r.nombre || r.nombre_proyecto)

        if (!parsed.length) { toast.error('No se encontraron filas válidas.'); return }

        const { error: delError } = await supabase.from('hh_acumulado_real').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (delError) { toast.error('Error al limpiar tabla: ' + delError.message); return }

        const CHUNK = 200
        for (let i = 0; i < parsed.length; i += CHUNK) {
          const { error } = await supabase.from('hh_acumulado_real').insert(parsed.slice(i, i + CHUNK))
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
      ['nombre', 'nombreProyecto', 'MontoHHReal', 'mes', 'En Proyectos?', 'En Colaboradores?'],
      ...filasFiltradas.map(r => [r.nombre, r.nombreProyecto, r.montoHHReal, r.mes, r.enProyectos ? 'Sí' : 'No', r.enColaboradores ? 'Sí' : 'No']),
      ['TOTAL', '', filasFiltradas.reduce((a, r) => a + (r.montoHHReal || 0), 0), '', '', ''],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'HH Acumulado Real')
    XLSX.writeFile(wb, 'hh_acumulado_real.xlsx')
  }

  // ── PIVOTS ──

  // pivot colaborador: { nombre → { mes → monto } }
  const colabPivot = useMemo(() => {
    const pivot = {}
    for (const r of rows) {
      if (!r.nombre || !r.mes) continue
      if (!pivot[r.nombre]) pivot[r.nombre] = {}
      pivot[r.nombre][r.mes] = (pivot[r.nombre][r.mes] || 0) + (r.montoHHReal || 0)
    }
    return pivot
  }, [rows])

  const colabKeys = useMemo(() => Object.keys(colabPivot).sort((a, b) => a.localeCompare(b, 'es')), [colabPivot])

  const colabKeysFiltrados = useMemo(() => {
    return colabKeys.filter(col => {
      const q = busquedaColabPivot.toLowerCase()
      const matchBusqueda = !q || col.toLowerCase().includes(q)
      const matchCol = !filtrosColabPivot.nombre?.length || filtrosColabPivot.nombre.includes(col)
      return matchBusqueda && matchCol
    })
  }, [colabKeys, busquedaColabPivot, filtrosColabPivot])

  const colabTotalPorMes = useMemo(() => {
    const tot = {}
    for (const mes of mesesCubiertos) {
      tot[mes] = colabKeysFiltrados.reduce((s, c) => s + (colabPivot[c]?.[mes] || 0), 0)
    }
    return tot
  }, [colabKeysFiltrados, colabPivot, mesesCubiertos])

  const colabTotalGeneral = useMemo(() => mesesCubiertos.reduce((s, m) => s + (colabTotalPorMes[m] || 0), 0), [colabTotalPorMes, mesesCubiertos])

  // pivot línea: { linea → { mes → monto } }
  const lineaPivot = useMemo(() => {
    const pivot = {}
    for (const r of rows) {
      if (!r.nombreProyecto || !r.mes) continue
      const linea = proyectosLinea[normalizeKey(r.nombreProyecto)] || ''
      if (!linea) continue
      if (!pivot[linea]) pivot[linea] = {}
      pivot[linea][r.mes] = (pivot[linea][r.mes] || 0) + (r.montoHHReal || 0)
    }
    return pivot
  }, [rows, proyectosLinea])

  const lineaKeys = useMemo(() => Object.keys(lineaPivot).sort((a, b) => a.localeCompare(b, 'es')), [lineaPivot])

  const lineaKeysFiltradas = useMemo(() => {
    return lineaKeys.filter(linea => {
      const q = busquedaLineaPivot.toLowerCase()
      const matchBusqueda = !q || linea.toLowerCase().includes(q)
      const matchLinea = !filtrosLineaPivot.linea?.length || filtrosLineaPivot.linea.includes(linea)
      return matchBusqueda && matchLinea
    })
  }, [lineaKeys, busquedaLineaPivot, filtrosLineaPivot])

  const lineaTotalPorMes = useMemo(() => {
    const tot = {}
    for (const mes of mesesCubiertos) {
      tot[mes] = lineaKeysFiltradas.reduce((s, l) => s + (lineaPivot[l]?.[mes] || 0), 0)
    }
    return tot
  }, [lineaKeysFiltradas, lineaPivot, mesesCubiertos])

  const lineaTotalGeneral = useMemo(() => mesesCubiertos.reduce((s, m) => s + (lineaTotalPorMes[m] || 0), 0), [lineaTotalPorMes, mesesCubiertos])

  // pivot detalle colaborador × proyecto: array de { nombre, nombreProyecto, [mes]: monto }
  const detallePivotFilas = useMemo(() => {
    const pivot = {}
    for (const r of rows) {
      if (!r.nombre || !r.nombreProyecto || !r.mes) continue
      const key = `${r.nombre}|||${r.nombreProyecto}`
      if (!pivot[key]) pivot[key] = { nombre: r.nombre, nombreProyecto: r.nombreProyecto }
      pivot[key][r.mes] = (pivot[key][r.mes] || 0) + (r.montoHHReal || 0)
    }
    return Object.values(pivot).sort((a, b) => {
      const cmp = (a.nombre || '').localeCompare(b.nombre || '', 'es')
      if (cmp !== 0) return cmp
      return (a.nombreProyecto || '').localeCompare(b.nombreProyecto || '', 'es')
    })
  }, [rows])

  const detalleFilasFiltradas = useMemo(() => {
    return detallePivotFilas.filter(row => {
      const q = busquedaDetallePivot.toLowerCase()
      const linea = proyectosLinea[normalizeKey(row.nombreProyecto)] || ''
      const matchBusqueda = !q || [row.nombre, row.nombreProyecto, linea].some(v => (v || '').toLowerCase().includes(q))
      const matchNombre = !filtrosDetallePivot.nombre?.length || filtrosDetallePivot.nombre.includes(row.nombre)
      const matchProyecto = !filtrosDetallePivot.nombreProyecto?.length || filtrosDetallePivot.nombreProyecto.includes(row.nombreProyecto)
      const matchLinea = !filtrosDetallePivot.linea?.length || filtrosDetallePivot.linea.includes(linea)
      return matchBusqueda && matchNombre && matchProyecto && matchLinea
    })
  }, [detallePivotFilas, busquedaDetallePivot, filtrosDetallePivot, proyectosLinea])

  const detalleTotalPorMes = useMemo(() => {
    const tot = {}
    for (const mes of mesesCubiertos) {
      tot[mes] = detalleFilasFiltradas.reduce((s, r) => s + (r[mes] || 0), 0)
    }
    return tot
  }, [detalleFilasFiltradas, mesesCubiertos])

  const detalleTotalGeneral = useMemo(() => mesesCubiertos.reduce((s, m) => s + (detalleTotalPorMes[m] || 0), 0), [detalleTotalPorMes, mesesCubiertos])

  // Opciones filtro pivots
  const opcionesColabPivot = colabKeys
  const opcionesLineaPivot = lineaKeys
  const opcionesNombreDetalle = useMemo(() => [...new Set(detallePivotFilas.map(r => r.nombre))].sort((a, b) => a.localeCompare(b, 'es')), [detallePivotFilas])
  const opcionesProyectoDetalle = useMemo(() => [...new Set(detallePivotFilas.map(r => r.nombreProyecto))].sort((a, b) => a.localeCompare(b, 'es')), [detallePivotFilas])
  const opcionesLineaDetalle = useMemo(() => [...new Set(detallePivotFilas.map(r => proyectosLinea[normalizeKey(r.nombreProyecto)] || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [detallePivotFilas, proyectosLinea])

  function exportarColabPivot() {
    const headerRow = ['COLABORADOR', ...mesesCubiertos, 'TOTAL']
    const dataRows = colabKeys.map(col => {
      const row = [col]
      let total = 0
      for (const mes of mesesCubiertos) { const v = colabPivot[col]?.[mes] || 0; row.push(Math.round(v)); total += v }
      row.push(Math.round(total))
      return row
    })
    const totalRow = ['TOTAL']
    let gt = 0
    for (const mes of mesesCubiertos) { const v = colabKeys.reduce((s, c) => s + (colabPivot[c]?.[mes] || 0), 0); totalRow.push(Math.round(v)); gt += v }
    totalRow.push(Math.round(gt))
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows, totalRow])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Costo por Colaborador')
    XLSX.writeFile(wb, 'hh_real_costo_colaborador.xlsx')
  }

  function exportarLineaPivot() {
    const headerRow = ['LÍNEA', ...mesesCubiertos, 'TOTAL']
    const dataRows = lineaKeys.map(linea => {
      const row = [linea]
      let total = 0
      for (const mes of mesesCubiertos) { const v = lineaPivot[linea]?.[mes] || 0; row.push(Math.round(v)); total += v }
      row.push(Math.round(total))
      return row
    })
    const totalRow = ['TOTAL']
    let gt = 0
    for (const mes of mesesCubiertos) { const v = lineaKeys.reduce((s, l) => s + (lineaPivot[l]?.[mes] || 0), 0); totalRow.push(Math.round(v)); gt += v }
    totalRow.push(Math.round(gt))
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows, totalRow])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Costo por Línea')
    XLSX.writeFile(wb, 'hh_real_costo_linea.xlsx')
  }

  function exportarDetallePivot() {
    const headerRow = ['COLABORADOR', 'PROYECTO', 'LÍNEA', ...mesesCubiertos, 'TOTAL']
    const dataRows = detallePivotFilas.map(row => {
      const linea = proyectosLinea[normalizeKey(row.nombreProyecto)] || ''
      const cells = [row.nombre, row.nombreProyecto, linea]
      let total = 0
      for (const mes of mesesCubiertos) { const v = row[mes] || 0; cells.push(Math.round(v)); total += v }
      cells.push(Math.round(total))
      return cells
    })
    const totalRow = ['TOTAL', '', '']
    let gt = 0
    for (const mes of mesesCubiertos) { const v = detallePivotFilas.reduce((s, r) => s + (r[mes] || 0), 0); totalRow.push(Math.round(v)); gt += v }
    totalRow.push(Math.round(gt))
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows, totalRow])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle por Colaborador')
    XLSX.writeFile(wb, 'hh_real_detalle_colaborador.xlsx')
  }

  const totalMonto = filasFiltradas.reduce((a, r) => a + (r.montoHHReal || 0), 0)
  const filasEnPagina = filasFiltradas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA)

  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">HH Acumulado Real</h2>
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
        Importa un Excel con columnas <code>nombre</code>, <code>nombreProyecto</code>, <code>MontoHHReal</code> y <code>mes</code>. Haz clic en cualquier celda para editarla.
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
          {/* ── TABLA PRINCIPAL ── */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <ResizableTh className="py-3 px-3 text-gray-500 font-semibold text-center bg-[#FFF5F0]" style={{ width: '48px' }}>#</ResizableTh>
                  <FilterableTh col="nombre" label="nombre" align="left"
                    opciones={opcionesPor('nombre')} filtro={filtros.nombre || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'nombre'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'nombre'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="nombreProyecto" label="nombreProyecto" align="left"
                    opciones={opcionesPor('nombreProyecto')} filtro={filtros.nombreProyecto || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'nombreProyecto'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'nombreProyecto'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="montoHHReal" label="MontoHHReal" align="right"
                    opciones={opcionesPor('montoHHReal')} filtro={filtros.montoHHReal || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'montoHHReal'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'montoHHReal'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="mes" label="mes" align="center"
                    opciones={opcionesPor('mes')} filtro={filtros.mes || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'mes'} onToggleDropdown={setDropdownFiltro}
                    sortable ordenActiva={ordenCol === 'mes'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                  <FilterableTh col="enProyectos" label="en proyectos?" align="center"
                    opciones={opcionesPor('enProyectos')} filtro={filtros.enProyectos || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'enProyectos'} onToggleDropdown={setDropdownFiltro} />
                  <FilterableTh col="enColaboradores" label="en colaboradores?" align="center"
                    opciones={opcionesPor('enColaboradores')} filtro={filtros.enColaboradores || []}
                    onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'enColaboradores'} onToggleDropdown={setDropdownFiltro} />
                </tr>
              </thead>
              <tbody>
                {filasEnPagina.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">Sin resultados.</td></tr>
                ) : filasEnPagina.map((row, i) => (
                  <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="border border-gray-300 px-2 py-2 text-center text-gray-500">{pagina * FILAS_POR_PAGINA + i + 1}</td>
                    {renderCelda(row, 'nombre', 'left', 'text-gray-800')}
                    {renderCelda(row, 'nombreProyecto', 'left', 'text-gray-800')}
                    {renderCelda(row, 'montoHHReal', 'right', 'font-medium text-gray-800')}
                    {renderCelda(row, 'mes', 'center', 'text-gray-600')}
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {row.enProyectos
                        ? <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">✓ Sí</span>
                        : <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">✗ No</span>}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {row.enColaboradores
                        ? <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">✓ Sí</span>
                        : <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">✗ No</span>}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td colSpan={3} className="px-3 py-3 text-sm text-gray-800">TOTAL ({filasFiltradas.length})</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-800">{formatPesos(totalMonto)}</td>
                  <td colSpan={3} className="px-3 py-3" />
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

          {/* ── RESUMEN POR COLABORADOR ── */}
          <div className="flex justify-between items-center pt-6 pb-1 flex-wrap gap-3">
            <h3 className="text-lg font-bold text-gray-800">Resumen de costo por colaborador</h3>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="text"
                value={busquedaColabPivot}
                onChange={e => setBusquedaColabPivot(e.target.value)}
                placeholder="Buscar colaborador..."
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
              />
              <button onClick={exportarColabPivot} disabled={colabKeys.length === 0}
                className="px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#6366F1' }}>
                Exportar Excel
              </button>
            </div>
          </div>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            {colabKeys.length === 0 ? (
              <p className="text-sm text-gray-400 italic p-4">Sin datos.</p>
            ) : (
              <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FFF5F0' }} className="border-b-2 border-gray-300">
                    <FilterableTh col="nombre" label="Colaborador" align="left" style={{ whiteSpace: 'nowrap' }}
                      opciones={opcionesColabPivot} filtro={filtrosColabPivot.nombre || []}
                      onFiltro={setFiltroColabPivot} dropdownAbierto={dropdownFiltroColabPivot === 'nombre'} onToggleDropdown={setDropdownFiltroColabPivot} />
                    {mesesCubiertos.map(mes => (
                      <th key={mes} className="py-2 px-3 text-right font-semibold text-gray-800 whitespace-nowrap bg-[#FFF5F0]">{mes}</th>
                    ))}
                    <th className="py-2 px-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-orange-50">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {colabKeysFiltrados.slice(paginaColabPivot * FILAS_POR_PAGINA, (paginaColabPivot + 1) * FILAS_POR_PAGINA).map((col, idx) => {
                    const rowTotal = mesesCubiertos.reduce((s, m) => s + (colabPivot[col]?.[m] || 0), 0)
                    return (
                      <tr key={col} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                        <td className="py-2 px-4 font-medium text-gray-700 whitespace-nowrap">{col}</td>
                        {mesesCubiertos.map(mes => {
                          const v = colabPivot[col]?.[mes] || 0
                          return <td key={mes} className={`py-2 px-3 text-right tabular-nums ${v === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{v === 0 ? '—' : Math.round(v).toLocaleString('es-CL')}</td>
                        })}
                        <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-50 tabular-nums">{Math.round(rowTotal).toLocaleString('es-CL')}</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                    <td className="py-2 px-4 text-gray-800">TOTAL ({colabKeysFiltrados.length})</td>
                    {mesesCubiertos.map(mes => (
                      <td key={mes} className="py-2 px-3 text-right tabular-nums text-gray-800">
                        {colabTotalPorMes[mes] === 0 ? '—' : Math.round(colabTotalPorMes[mes]).toLocaleString('es-CL')}
                      </td>
                    ))}
                    <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-100 tabular-nums">{Math.round(colabTotalGeneral).toLocaleString('es-CL')}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          {colabKeysFiltrados.length > FILAS_POR_PAGINA && (
            <div className="flex justify-between items-center py-2 text-sm text-gray-600">
              <span>{paginaColabPivot * FILAS_POR_PAGINA + 1}–{Math.min((paginaColabPivot + 1) * FILAS_POR_PAGINA, colabKeysFiltrados.length)} de {colabKeysFiltrados.length}</span>
              <div className="flex gap-2">
                <button onClick={() => setPaginaColabPivot(p => Math.max(0, p - 1))} disabled={paginaColabPivot === 0}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
                <button onClick={() => setPaginaColabPivot(p => p + 1)} disabled={(paginaColabPivot + 1) * FILAS_POR_PAGINA >= colabKeysFiltrados.length}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
              </div>
            </div>
          )}

          {/* ── RESUMEN DE COSTO POR LÍNEA ── */}
          <div className="flex justify-between items-center pt-6 pb-1 flex-wrap gap-3">
            <h3 className="text-lg font-bold text-gray-800">Resumen de costo por línea</h3>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="text"
                value={busquedaLineaPivot}
                onChange={e => setBusquedaLineaPivot(e.target.value)}
                placeholder="Buscar línea..."
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
              />
              <button onClick={exportarLineaPivot} disabled={lineaKeys.length === 0}
                className="px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#6366F1' }}>
                Exportar Excel
              </button>
            </div>
          </div>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            {lineaKeys.length === 0 ? (
              <p className="text-sm text-gray-400 italic p-4">Sin datos de línea. Asegúrate de que los proyectos tengan CECO asignado.</p>
            ) : (
              <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FFF5F0' }} className="border-b-2 border-gray-300">
                    <FilterableTh col="linea" label="Línea" align="left" style={{ whiteSpace: 'nowrap' }}
                      opciones={opcionesLineaPivot} filtro={filtrosLineaPivot.linea || []}
                      onFiltro={setFiltroLineaPivot} dropdownAbierto={dropdownFiltroLineaPivot === 'linea'} onToggleDropdown={setDropdownFiltroLineaPivot} />
                    {mesesCubiertos.map(mes => (
                      <th key={mes} className="py-2 px-3 text-right font-semibold text-gray-800 whitespace-nowrap bg-[#FFF5F0]">{mes}</th>
                    ))}
                    <th className="py-2 px-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-orange-50">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineaKeysFiltradas.slice(paginaLineaPivot * FILAS_POR_PAGINA, (paginaLineaPivot + 1) * FILAS_POR_PAGINA).map((linea, idx) => {
                    const rowTotal = mesesCubiertos.reduce((s, m) => s + (lineaPivot[linea]?.[m] || 0), 0)
                    return (
                      <tr key={linea} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                        <td className="py-2 px-4 font-medium text-gray-700 whitespace-nowrap">{linea}</td>
                        {mesesCubiertos.map(mes => {
                          const v = lineaPivot[linea]?.[mes] || 0
                          return <td key={mes} className={`py-2 px-3 text-right tabular-nums ${v === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{v === 0 ? '—' : Math.round(v).toLocaleString('es-CL')}</td>
                        })}
                        <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-50 tabular-nums">{Math.round(rowTotal).toLocaleString('es-CL')}</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                    <td className="py-2 px-4 text-gray-800">TOTAL ({lineaKeysFiltradas.length})</td>
                    {mesesCubiertos.map(mes => (
                      <td key={mes} className="py-2 px-3 text-right tabular-nums text-gray-800">
                        {lineaTotalPorMes[mes] === 0 ? '—' : Math.round(lineaTotalPorMes[mes]).toLocaleString('es-CL')}
                      </td>
                    ))}
                    <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-100 tabular-nums">{Math.round(lineaTotalGeneral).toLocaleString('es-CL')}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          {lineaKeysFiltradas.length > FILAS_POR_PAGINA && (
            <div className="flex justify-between items-center py-2 text-sm text-gray-600">
              <span>{paginaLineaPivot * FILAS_POR_PAGINA + 1}–{Math.min((paginaLineaPivot + 1) * FILAS_POR_PAGINA, lineaKeysFiltradas.length)} de {lineaKeysFiltradas.length}</span>
              <div className="flex gap-2">
                <button onClick={() => setPaginaLineaPivot(p => Math.max(0, p - 1))} disabled={paginaLineaPivot === 0}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
                <button onClick={() => setPaginaLineaPivot(p => p + 1)} disabled={(paginaLineaPivot + 1) * FILAS_POR_PAGINA >= lineaKeysFiltradas.length}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
              </div>
            </div>
          )}

          {/* ── DETALLE POR COLABORADOR Y PROYECTO ── */}
          <div className="flex justify-between items-center pt-6 pb-1 flex-wrap gap-3">
            <h3 className="text-lg font-bold text-gray-800">Costo por colaborador y proyecto</h3>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="text"
                value={busquedaDetallePivot}
                onChange={e => setBusquedaDetallePivot(e.target.value)}
                placeholder="Buscar..."
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
              />
              <button onClick={exportarDetallePivot} disabled={detallePivotFilas.length === 0}
                className="px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#6366F1' }}>
                Exportar Excel
              </button>
            </div>
          </div>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            {detallePivotFilas.length === 0 ? (
              <p className="text-sm text-gray-400 italic p-4">Sin datos.</p>
            ) : (
              <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FFF5F0' }} className="border-b-2 border-gray-300">
                    <FilterableTh col="nombre" label="Colaborador" align="left" style={{ whiteSpace: 'nowrap' }}
                      opciones={opcionesNombreDetalle} filtro={filtrosDetallePivot.nombre || []}
                      onFiltro={setFiltroDetallePivot} dropdownAbierto={dropdownFiltroDetallePivot === 'nombre'} onToggleDropdown={setDropdownFiltroDetallePivot} />
                    <FilterableTh col="nombreProyecto" label="Proyecto" align="left" style={{ whiteSpace: 'nowrap' }}
                      opciones={opcionesProyectoDetalle} filtro={filtrosDetallePivot.nombreProyecto || []}
                      onFiltro={setFiltroDetallePivot} dropdownAbierto={dropdownFiltroDetallePivot === 'nombreProyecto'} onToggleDropdown={setDropdownFiltroDetallePivot} />
                    <FilterableTh col="linea" label="Línea" align="left" style={{ whiteSpace: 'nowrap' }}
                      opciones={opcionesLineaDetalle} filtro={filtrosDetallePivot.linea || []}
                      onFiltro={setFiltroDetallePivot} dropdownAbierto={dropdownFiltroDetallePivot === 'linea'} onToggleDropdown={setDropdownFiltroDetallePivot} />
                    {mesesCubiertos.map(mes => (
                      <th key={mes} className="py-2 px-3 text-right font-semibold text-gray-800 whitespace-nowrap bg-[#FFF5F0]">{mes}</th>
                    ))}
                    <th className="py-2 px-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-orange-50">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleFilasFiltradas.slice(paginaDetallePivot * FILAS_POR_PAGINA, (paginaDetallePivot + 1) * FILAS_POR_PAGINA).map((row, idx) => {
                    const linea = proyectosLinea[normalizeKey(row.nombreProyecto)] || ''
                    const rowTotal = mesesCubiertos.reduce((s, m) => s + (row[m] || 0), 0)
                    return (
                      <tr key={`${row.nombre}|||${row.nombreProyecto}`} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                        <td className="py-2 px-4 font-medium text-gray-700 whitespace-nowrap">{row.nombre}</td>
                        <td className="py-2 px-4 text-gray-700 whitespace-nowrap">{row.nombreProyecto}</td>
                        <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{linea || <span className="text-gray-300">—</span>}</td>
                        {mesesCubiertos.map(mes => {
                          const v = row[mes] || 0
                          return <td key={mes} className={`py-2 px-3 text-right tabular-nums ${v === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{v === 0 ? '—' : Math.round(v).toLocaleString('es-CL')}</td>
                        })}
                        <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-50 tabular-nums">{Math.round(rowTotal).toLocaleString('es-CL')}</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                    <td colSpan={3} className="py-2 px-4 text-gray-800">TOTAL ({detalleFilasFiltradas.length})</td>
                    {mesesCubiertos.map(mes => (
                      <td key={mes} className="py-2 px-3 text-right tabular-nums text-gray-800">
                        {detalleTotalPorMes[mes] === 0 ? '—' : Math.round(detalleTotalPorMes[mes]).toLocaleString('es-CL')}
                      </td>
                    ))}
                    <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-100 tabular-nums">{Math.round(detalleTotalGeneral).toLocaleString('es-CL')}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          {detalleFilasFiltradas.length > FILAS_POR_PAGINA && (
            <div className="flex justify-between items-center py-2 text-sm text-gray-600">
              <span>{paginaDetallePivot * FILAS_POR_PAGINA + 1}–{Math.min((paginaDetallePivot + 1) * FILAS_POR_PAGINA, detalleFilasFiltradas.length)} de {detalleFilasFiltradas.length}</span>
              <div className="flex gap-2">
                <button onClick={() => setPaginaDetallePivot(p => Math.max(0, p - 1))} disabled={paginaDetallePivot === 0}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
                <button onClick={() => setPaginaDetallePivot(p => p + 1)} disabled={(paginaDetallePivot + 1) * FILAS_POR_PAGINA >= detalleFilasFiltradas.length}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
