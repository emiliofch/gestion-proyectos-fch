import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import FilterableTh from './FilterableTh'
import { supabase } from '../supabaseClient'

const STORAGE_BUCKET = 'archivos-privados'
const PRESUPUESTO_FILE = 'ppto2026.xlsx'
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const HEADER_KEYS = {
  linea: ['linea', 'línea'],
  proyecto: ['proyecto'],
  fechaAdjudicacion: ['fecha_de_adjudicacion', 'fecha_adjudicacion', 'fecha de adjudicacion', 'fecha de adjudicacion'],
  ingreso: ['ingreso', 'ingresos'],
  hh: ['hh'],
  ggoo: ['ggoo', 'gastos', 'gasto'],
  margen: ['margen', 'mg'],
  estado: ['estado'],
  publico: ['publico', 'publico?'],
  rendible: ['rendible', 'rendible?'],
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_?]+/g, '')
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value).trim()
  if (raw === '-' || raw === '') return null
  const cleaned = raw
    .replace(/\$/g, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
  const parsed = parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '-'
  return '$' + Number(value).toLocaleString('es-CL', { maximumFractionDigits: 0 })
}

function formatFechaAdjudicacion(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    const lower = trimmed.toLowerCase()
    if (/^[a-z]{3}-\d{2}$/.test(lower)) return lower
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return `${MESES_ABR[parsed.getMonth()]}-${String(parsed.getFullYear()).slice(-2)}`
    }
    return trimmed
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed && parsed.y && parsed.m) {
      return `${MESES_ABR[parsed.m - 1]}-${String(parsed.y).slice(-2)}`
    }
    return String(value)
  }
  return String(value)
}

function getValueFromRow(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key]
  }
  return undefined
}

export default function VistaPresupuesto2026() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('linea')
  const [ordenDir, setOrdenDir] = useState('asc')

  useEffect(() => {
    cargarPresupuesto()
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  async function cargarPresupuesto() {
    setLoading(true)
    try {
      const { data: blob, error } = await supabase.storage.from(STORAGE_BUCKET).download(PRESUPUESTO_FILE)
      if (error) {
        toast.error('No se encontro el archivo ppto2026.xlsx en Storage')
        setRows([])
        return
      }

      const arrayBuffer = await blob.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)

      const parsed = data.map((rawRow) => {
        const normalized = {}
        Object.keys(rawRow || {}).forEach((key) => {
          normalized[normalizeKey(key)] = rawRow[key]
        })

        return {
          linea: String(getValueFromRow(normalized, HEADER_KEYS.linea) || '').trim(),
          proyecto: String(getValueFromRow(normalized, HEADER_KEYS.proyecto) || '').trim(),
          fechaAdjudicacion: formatFechaAdjudicacion(getValueFromRow(normalized, HEADER_KEYS.fechaAdjudicacion)),
          ingreso: parseNumber(getValueFromRow(normalized, HEADER_KEYS.ingreso)),
          hh: parseNumber(getValueFromRow(normalized, HEADER_KEYS.hh)),
          ggoo: parseNumber(getValueFromRow(normalized, HEADER_KEYS.ggoo)),
          margen: parseNumber(getValueFromRow(normalized, HEADER_KEYS.margen)),
          estado: String(getValueFromRow(normalized, HEADER_KEYS.estado) || '').trim(),
          publico: String(getValueFromRow(normalized, HEADER_KEYS.publico) || '').trim(),
          rendible: String(getValueFromRow(normalized, HEADER_KEYS.rendible) || '').trim(),
        }
      }).filter((row) => row.linea || row.proyecto)

      setRows(parsed)
    } catch (error) {
      toast.error('Error leyendo ppto2026: ' + error.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

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

  const opciones = useMemo(() => {
    const lineas = new Set()
    const proyectos = new Set()
    const fechas = new Set()
    const estados = new Set()
    const publicos = new Set()
    const rendibles = new Set()
    rows.forEach((r) => {
      if (r.linea) lineas.add(r.linea)
      if (r.proyecto) proyectos.add(r.proyecto)
      if (r.fechaAdjudicacion) fechas.add(r.fechaAdjudicacion)
      if (r.estado) estados.add(r.estado)
      if (r.publico) publicos.add(r.publico)
      if (r.rendible) rendibles.add(r.rendible)
    })
    const ordenar = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })
    return {
      linea: [...lineas].sort(ordenar),
      proyecto: [...proyectos].sort(ordenar),
      fechaAdjudicacion: [...fechas].sort(ordenar),
      estado: [...estados].sort(ordenar),
      publico: [...publicos].sort(ordenar),
      rendible: [...rendibles].sort(ordenar),
    }
  }, [rows])

  const filtradas = useMemo(() => {
    return rows.filter((r) => {
      if (filtros.linea && filtros.linea.length > 0 && !filtros.linea.includes(r.linea)) return false
      if (filtros.proyecto && filtros.proyecto.length > 0 && !filtros.proyecto.includes(r.proyecto)) return false
      if (filtros.fechaAdjudicacion && filtros.fechaAdjudicacion.length > 0 && !filtros.fechaAdjudicacion.includes(r.fechaAdjudicacion)) return false
      if (filtros.estado && filtros.estado.length > 0 && !filtros.estado.includes(r.estado)) return false
      if (filtros.publico && filtros.publico.length > 0 && !filtros.publico.includes(r.publico)) return false
      if (filtros.rendible && filtros.rendible.length > 0 && !filtros.rendible.includes(r.rendible)) return false
      return true
    }).sort((a, b) => {
      let vA
      let vB
      switch (ordenCol) {
        case 'linea': vA = a.linea || ''; vB = b.linea || ''; break
        case 'proyecto': vA = a.proyecto || ''; vB = b.proyecto || ''; break
        case 'fechaAdjudicacion': vA = a.fechaAdjudicacion || ''; vB = b.fechaAdjudicacion || ''; break
        case 'ingreso': vA = a.ingreso || 0; vB = b.ingreso || 0; break
        case 'hh': vA = a.hh || 0; vB = b.hh || 0; break
        case 'ggoo': vA = a.ggoo || 0; vB = b.ggoo || 0; break
        case 'margen': vA = a.margen || 0; vB = b.margen || 0; break
        case 'estado': vA = a.estado || ''; vB = b.estado || ''; break
        case 'publico': vA = a.publico || ''; vB = b.publico || ''; break
        case 'rendible': vA = a.rendible || ''; vB = b.rendible || ''; break
        default: vA = ''; vB = ''
      }
      if (typeof vA === 'string') vA = vA.toLowerCase()
      if (typeof vB === 'string') vB = vB.toLowerCase()
      if (vA < vB) return ordenDir === 'asc' ? -1 : 1
      if (vA > vB) return ordenDir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, filtros, ordenCol, ordenDir])

  const totales = useMemo(() => {
    return filtradas.reduce(
      (acc, r) => {
        acc.ingreso += r.ingreso || 0
        acc.hh += r.hh || 0
        acc.ggoo += r.ggoo || 0
        acc.margen += r.margen || 0
        return acc
      },
      { ingreso: 0, hh: 0, ggoo: 0, margen: 0 }
    )
  }, [filtradas])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Presupuesto 2026</h2>
      </div>

      <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-sm text-gray-700">
          Fuente: archivo <strong>ppto2026.xlsx</strong> en Supabase Storage (bucket <strong>archivos-privados</strong>).
        </p>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando presupuesto...</p>
          </div>
        ) : (
          <table className="w-full">
  <thead>
    <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
      <FilterableTh col="linea" label="Línea" align="left" style={{ width: '160px' }} opciones={opciones.linea} filtro={filtros.linea || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro==='linea'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol==='linea'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
      <FilterableTh col="proyecto" label="Proyecto" align="left" style={{ width: '240px' }} opciones={opciones.proyecto} filtro={filtros.proyecto || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro==='proyecto'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol==='proyecto'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
      <FilterableTh col="fechaAdjudicacion" label="Fecha de adjudicacion" align="center" style={{ width: '150px' }} opciones={opciones.fechaAdjudicacion || []} filtro={filtros.fechaAdjudicacion || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro==='fechaAdjudicacion'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol==='fechaAdjudicacion'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
      <FilterableTh col="ingreso" label="Ingreso" align="right" style={{ width: '110px' }} opciones={[]} filtro={[]} onFiltro={() => {}} dropdownAbierto={false} onToggleDropdown={() => {}} sortable ordenActiva={ordenCol==='ingreso'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
      <FilterableTh col="hh" label="HH" align="right" style={{ width: '110px' }} opciones={[]} filtro={[]} onFiltro={() => {}} dropdownAbierto={false} onToggleDropdown={() => {}} sortable ordenActiva={ordenCol==='hh'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
      <FilterableTh col="ggoo" label="GGOO" align="right" style={{ width: '110px' }} opciones={[]} filtro={[]} onFiltro={() => {}} dropdownAbierto={false} onToggleDropdown={() => {}} sortable ordenActiva={ordenCol==='ggoo'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
      <FilterableTh col="margen" label="Margen" align="right" style={{ width: '110px' }} opciones={[]} filtro={[]} onFiltro={() => {}} dropdownAbierto={false} onToggleDropdown={() => {}} sortable ordenActiva={ordenCol==='margen'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
      <FilterableTh col="estado" label="Estado" align="center" style={{ width: '130px' }} opciones={opciones.estado} filtro={filtros.estado || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro==='estado'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol==='estado'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
      <FilterableTh col="publico" label="Publico?" align="center" style={{ width: '120px' }} opciones={opciones.publico} filtro={filtros.publico || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro==='publico'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol==='publico'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
      <FilterableTh col="rendible" label="Rendible?" align="center" style={{ width: '130px' }} opciones={opciones.rendible} filtro={filtros.rendible || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro==='rendible'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol==='rendible'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
    </tr>
  </thead>
  <tbody>
    {filtradas.map((r, idx) => (
      <tr key={`${r.linea}-${r.proyecto}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
        <td className="py-3 px-4 text-gray-700 text-sm">{r.linea || '-'}</td>
        <td className="py-3 px-4 text-gray-800 font-medium text-sm">{r.proyecto || '-'}</td>
        <td className="py-3 px-4 text-center text-sm">{r.fechaAdjudicacion || '-'}</td>
        <td className="py-3 px-4 text-right">{formatCurrency(r.ingreso)}</td>
        <td className="py-3 px-4 text-right">{formatCurrency(r.hh)}</td>
        <td className="py-3 px-4 text-right">{formatCurrency(r.ggoo)}</td>
        <td className={`py-3 px-4 text-right font-semibold ${(r.margen || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(r.margen)}</td>
        <td className="py-3 px-4 text-center">{r.estado || '-'}</td>
        <td className="py-3 px-4 text-center">{r.publico || '-'}</td>
        <td className="py-3 px-4 text-center">{r.rendible || '-'}</td>
      </tr>
    ))}
    {filtradas.length > 0 && (
      <tr className="bg-green-100 font-semibold">
        <td className="py-3 px-4">TOTAL</td>
        <td className="py-3 px-4"></td>
        <td className="py-3 px-4"></td>
        <td className="py-3 px-4 text-right">{formatCurrency(totales.ingreso)}</td>
        <td className="py-3 px-4 text-right">{formatCurrency(totales.hh)}</td>
        <td className="py-3 px-4 text-right">{formatCurrency(totales.ggoo)}</td>
        <td className="py-3 px-4 text-right">{formatCurrency(totales.margen)}</td>
        <td className="py-3 px-4"></td>
        <td className="py-3 px-4"></td>
        <td className="py-3 px-4"></td>
      </tr>
    )}
  </tbody>
</table>
        )}
      </div>
    </div>
  )
}








