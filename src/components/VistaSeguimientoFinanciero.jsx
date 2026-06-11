import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { toast } from 'react-toastify'
import { normalizarEstadoProyecto } from '../constants/estadosProyecto'
import { normalizarMesAdjudicacion } from '../constants/fechaAdjudicacion'
import FilterableTh from './FilterableTh'
import ResizableTh from './ResizableTh'
import { CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const NOTAS_TIPO_OPERACIONAL = 'operacional'
const NOTAS_TIPO_SENSIBILIDAD = 'sensibilidad'
const DEFAULT_EXCEL_PATH = '/seguimiento_operacional.xlsx'
const PRESUPUESTO_PATH = '/ppto2026.xlsx'
const HH_PROYECTADAS_PATH = '/hh_proyectadas_2026.xlsx'
const ESTADOS_PIPELINE = new Set(['Efectivo', 'No Efectivo'])
const ESTADOS_SENSIBILIDAD = new Set(['Efectivo', 'Adjudicado', 'Cancelado', 'Meta'])
const ESTADOS_HEATMAP = new Set(['No Efectivo', 'Meta'])
const ESTADOS_TODOS_SIN_CANCELADO = new Set(['Efectivo', 'No Efectivo', 'Adjudicado', 'Meta'])
const MESES_HH_ALL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
const MESES_HH_VIEW = [
  'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
const MESES_ORDEN = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const HEADER_KEYS = {
  linea: ['linea', 'linea_nombre', 'linea nombre', 'linea_nombre'],
  real: {
    ingresos: ['real_ingreso', 'real_ingresos', 'ingreso_real', 'ingresos_real', 'real_ing', 'ing_real'],
    hh: ['real_hh', 'hh_real', 'hh_real'],
    gasto: ['real_gasto', 'real_gastos', 'gasto_real', 'gastos_real', 'real_gg', 'real_ggoo', 'ggoo_real'],
    margen: ['real_margen', 'margen_real', 'real_mg', 'mg_real']
  },
  ppto: {
    ingresos: ['ppto_ingreso', 'ppto_ingresos', 'presupuesto_ingreso', 'presupuesto_ingresos', 'ingreso_ppto', 'ingresos_ppto', 'ing_ppto'],
    hh: ['ppto_hh', 'hh_ppto', 'presupuesto_hh', 'hh_ppto'],
    gasto: ['ppto_gasto', 'ppto_gastos', 'gasto_ppto', 'gastos_ppto', 'presupuesto_gasto', 'presupuesto_gastos', 'ggoo_ppto'],
    margen: ['ppto_margen', 'margen_ppto', 'presupuesto_margen', 'mg_ppto']
  }
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]+/g, '')
}

function getValueFromRow(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key]
  }
  return undefined
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function formatNumber(value) {
  if (value === null || value === undefined) return '-'
  const millones = Number(value) / 1_000_000
  return '$' + millones.toLocaleString('es-CL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })
}

function formatPercent(value) {
  if (value === null || value === undefined) return '-'
  return `${(Number(value) * 100).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`
}


function buildPdfDateLabel() {
  return new Date().toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function buildPdfFileTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

function diffCellStyle(value, maxAbs, invert = false) {
  if (value === null || value === undefined || !maxAbs) return undefined
  const abs = Math.abs(value)
  if (abs === 0) return undefined
  const pct = Math.min(100, Math.round((abs / maxAbs) * 100))
  const isPositive = value >= 0
  const isGood = invert ? !isPositive : isPositive
  const color = isGood ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'
  return { background: `linear-gradient(90deg, ${color} ${pct}%, transparent 0%)` }
}

function normalizeLinea(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function buildEmptyMetrics() {
  return {
    real: { ingresos: null, hh: null, gasto: null, margen: null },
    ppto: { ingresos: null, hh: null, gasto: null, margen: null }
  }
}

export default function VistaSeguimientoFinanciero({ user, perfil }) {
  const [lineas, setLineas] = useState([])
  const [dataByLinea, setDataByLinea] = useState({})
  const [notas, setNotas] = useState('')
  const [notasSens, setNotasSens] = useState('')
  const editorRef = useRef(null)
  const editorSensRef = useRef(null)
  const reporteRef = useRef(null)
  const [notasCargadas, setNotasCargadas] = useState(false)
  const [notasSensCargadas, setNotasSensCargadas] = useState(false)
  const [autoLoaded, setAutoLoaded] = useState(false)
  const [pipeline, setPipeline] = useState([])
  const [oportunidadesRaw, setOportunidadesRaw] = useState([])
  const [loadingPipeline, setLoadingPipeline] = useState(false)
  const [presupuestoLineas, setPresupuestoLineas] = useState({})
  const [heatmapRows, setHeatmapRows] = useState([])
  const [loadingHeatmap, setLoadingHeatmap] = useState(false)
  const [filtrosPipeline, setFiltrosPipeline] = useState({})
  const [dropdownPipeline, setDropdownPipeline] = useState(null)
  const [ordenPipelineCol, setOrdenPipelineCol] = useState(null)
  const [ordenPipelineDir, setOrdenPipelineDir] = useState('asc')
  const [costoPorProyecto, setCostoPorProyecto] = useState({}) // normalizeKey(nombre) → costo total HP
  const [costoPorProyectoReal, setCostoPorProyectoReal] = useState({}) // normalizeKey(nombre) → solo monto_hh_real
  const [allProyectos, setAllProyectos] = useState([])     // todos los proyectos sin filtro de nulos
  const [ingresoRealMap, setIngresoRealMap] = useState({}) // normalizeKey(nombre) → monto ingreso real
  const [gastoRealMap, setGastoRealMap] = useState({})     // normalizeKey(nombre) → monto gasto real

  useEffect(() => {
    cargarLineas()
    cargarPipeline()
    cargarPresupuestoLineas()
    cargarHeatmapNoEfectivos()
    cargarHHProyectadas()
    cargarRealMaps()
  }, [])

  useEffect(() => {
    if (!perfil?.empresa || !user?.id) return

    async function cargarNotas(tipo, setter, setLoaded) {
      const { data, error } = await supabase
        .from('seguimiento_financiero_notas')
        .select('contenido_html')
        .eq('empresa', perfil.empresa)
        .eq('tipo', tipo)
        .single()

      if (error && error.code !== 'PGRST116') {
        toast.error('Error cargando notas: ' + error.message)
        return
      }
      if (data?.contenido_html) {
        setter(data.contenido_html)
      }
      setLoaded(true)
    }

    cargarNotas(NOTAS_TIPO_OPERACIONAL, setNotas, setNotasCargadas)
    cargarNotas(NOTAS_TIPO_SENSIBILIDAD, setNotasSens, setNotasSensCargadas)
  }, [perfil?.empresa, user?.id])

  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML !== notas) {
      editorRef.current.innerHTML = notas
    }
  }, [notas])

  useEffect(() => {
    if (!editorSensRef.current) return
    if (editorSensRef.current.innerHTML !== notasSens) {
      editorSensRef.current.innerHTML = notasSens
    }
  }, [notasSens])

  useEffect(() => {
    if (!notasCargadas || !perfil?.empresa) return
    const timeout = setTimeout(() => {
      supabase
        .from('seguimiento_financiero_notas')
        .upsert({
          empresa: perfil.empresa,
          tipo: NOTAS_TIPO_OPERACIONAL,
          contenido_html: notas,
        }, { onConflict: 'empresa,tipo' })
        .then(({ error }) => {
          if (error) {
            toast.error('Error guardando notas: ' + error.message)
          }
        })
    }, 700)
    return () => clearTimeout(timeout)
  }, [notas, notasCargadas, perfil?.empresa])

  useEffect(() => {
    if (!notasSensCargadas || !perfil?.empresa) return
    const timeout = setTimeout(() => {
      supabase
        .from('seguimiento_financiero_notas')
        .upsert({
          empresa: perfil.empresa,
          tipo: NOTAS_TIPO_SENSIBILIDAD,
          contenido_html: notasSens,
        }, { onConflict: 'empresa,tipo' })
        .then(({ error }) => {
          if (error) {
            toast.error('Error guardando notas: ' + error.message)
          }
        })
    }, 700)
    return () => clearTimeout(timeout)
  }, [notasSens, notasSensCargadas, perfil?.empresa])

  useEffect(() => {
    if (!dropdownPipeline) return
    function cerrar() { setDropdownPipeline(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownPipeline])

  const lineasUnicas = useMemo(() => {
    const seen = new Set()
    const unique = []
    lineas.forEach((linea) => {
      const key = normalizeLinea(linea.linea)
      if (!key || seen.has(key)) return
      seen.add(key)
      unique.push(linea)
    })
    return unique
  }, [lineas])

  useEffect(() => {
    if (!lineas.length || autoLoaded) return

    async function cargarExcelLocal() {
      try {
        setDataByLinea({})
        const response = await fetch(`${DEFAULT_EXCEL_PATH}?t=${Date.now()}`, { cache: 'no-store' })
        if (!response.ok) return
        const arrayBuffer = await response.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet)
        if (!data.length) return
        const parsed = buildDataFromRows(data)
        if (Object.keys(parsed).length > 0) {
          setDataByLinea(parsed)
        }
      } catch (error) {
        toast.error('Error leyendo seguimiento_operacional.xlsx: ' + error.message)
      } finally {
        setAutoLoaded(true)
      }
    }

    cargarExcelLocal()
  }, [autoLoaded, lineasUnicas])

  async function cargarLineas() {
    const { data, error } = await supabase.from('lineas').select('id, linea').order('linea', { ascending: true })
    if (error) {
      toast.error('Error cargando lineas: ' + error.message)
      return
    }
    setLineas(data || [])
  }

  async function cargarHHProyectadas() {
    // Costos mensuales: { normalizeKey(colaborador) → { mes → costo_mes } }
    const costoMap = {}
    let cfrom = 0
    while (true) {
      const { data } = await supabase.from('colaboradores_costos').select('colaborador, mes, costo_mes').range(cfrom, cfrom + 999)
      if (!data?.length) break
      for (const c of data) {
        const key = normalizeKey(c.colaborador)
        if (!costoMap[key]) costoMap[key] = {}
        costoMap[key][c.mes] = parseFloat(c.costo_mes) || 0
      }
      if (data.length < 1000) break
      cfrom += 1000
    }

    const PAGE = 1000
    let todas = [], from = 0
    while (true) {
      const { data } = await supabase
        .from('horas_proyectadas')
        .select('proyecto, colaborador, horas, mes')
        .range(from, from + PAGE - 1)
      if (!data?.length) break
      todas = [...todas, ...data]
      if (data.length < PAGE) break
      from += PAGE
    }

    // Meses con data real bloquean TODO lo proyectado de ese mes
    const { data: reales } = await supabase
      .from('hh_acumulado_real')
      .select('nombre_proyecto, mes, monto_hh_real')
    const mesesCubiertos = new Set()
    const acumProyecto = {}
    for (const r of reales || []) {
      const pKey = normalizeKey(r.nombre_proyecto)
      if (!pKey) continue
      if (r.mes) mesesCubiertos.add(r.mes)
      acumProyecto[pKey] = (acumProyecto[pKey] || 0) + (parseFloat(r.monto_hh_real) || 0)
    }
    const acumProyectoReal = { ...acumProyecto }
    for (const f of todas) {
      if (mesesCubiertos.has(f.mes)) continue
      const pKey = normalizeKey(f.proyecto)
      const costo = (parseFloat(f.horas) || 0) * (costoMap[normalizeKey(f.colaborador)]?.[f.mes] || 0)
      if (pKey) acumProyecto[pKey] = (acumProyecto[pKey] || 0) + costo
    }
    setCostoPorProyecto(acumProyecto)
    setCostoPorProyectoReal(acumProyectoReal)
  }

  async function cargarPipeline() {
    setLoadingPipeline(true)
    const { data, error } = await supabase
      .from('proyectos')
      .select('id, ingresos, gastos, fecha_adjudicacion, nombre, ceco, estado, colaboradores:jefe_id(colaborador)')
      .order('nombre', { ascending: true })

    if (error) {
      toast.error('Error cargando proyectos: ' + error.message)
      setPipeline([])
      setLoadingPipeline(false)
      return
    }

    setAllProyectos(data || [])

    const base = (data || [])
      .filter(p => p.ingresos !== null || p.gastos !== null)
      .map(p => ({
        id: p.id,
        ingresos: p.ingresos,
        gastos: p.gastos,
        fecha_adjudicacion: p.fecha_adjudicacion,
        proyectos: {
          nombre: p.nombre,
          ceco: p.ceco,
          estado: p.estado,
          fecha_adjudicacion: p.fecha_adjudicacion,
          colaboradores: p.colaboradores
        }
      }))

    const filtradas = base.filter((o) => {
      const estado = normalizarEstadoProyecto(o.proyectos?.estado) || ''
      return ESTADOS_PIPELINE.has(estado)
    })

    setOportunidadesRaw(base)
    setPipeline(filtradas)
    setLoadingPipeline(false)
  }

  async function cargarRealMaps() {
    const [{ data: ing }, { data: gasto }] = await Promise.all([
      supabase.from('ingreso_real_acumulado').select('nombre, ingreso'),
      supabase.from('gasto_real_acumulado').select('nombre, gasto'),
    ])
    const iMap = {}
    for (const r of ing || []) {
      const k = normalizeKey(r.nombre)
      if (k) iMap[k] = (iMap[k] || 0) + (parseFloat(r.ingreso) || 0)
    }
    const gMap = {}
    for (const r of gasto || []) {
      const k = normalizeKey(r.nombre)
      if (k) gMap[k] = (gMap[k] || 0) + (parseFloat(r.gasto) || 0)
    }
    setIngresoRealMap(iMap)
    setGastoRealMap(gMap)
  }

  async function cargarPresupuestoLineas() {
    try {
      const response = await fetch(PRESUPUESTO_PATH)
      if (!response.ok) return
      const arrayBuffer = await response.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)

      const acumulado = {}
      data.forEach((rawRow) => {
        const normalized = {}
        Object.keys(rawRow || {}).forEach((key) => {
          normalized[normalizeKey(key)] = rawRow[key]
        })
        const linea = String(getValueFromRow(normalized, ['linea', 'linea_nombre', 'linea nombre']) || '').trim()
        if (!linea) return
        const key = normalizeLinea(linea)
        const ingreso = parseNumber(getValueFromRow(normalized, ['ingreso', 'ingresos'])) || 0
        const hh = parseNumber(getValueFromRow(normalized, ['hh'])) || 0
        const gasto = parseNumber(getValueFromRow(normalized, ['ggoo', 'gastos', 'gasto'])) || 0
        const margen = parseNumber(getValueFromRow(normalized, ['margen', 'mg'])) || (ingreso - hh - gasto)
        if (!acumulado[key]) {
          acumulado[key] = { linea, ingresos: 0, hh: 0, gasto: 0, margen: 0 }
        }
        acumulado[key].ingresos += ingreso
        acumulado[key].hh += hh
        acumulado[key].gasto += gasto
        acumulado[key].margen += margen
      })

      setPresupuestoLineas(acumulado)
    } catch (error) {
      toast.error('Error leyendo ppto2026.xlsx: ' + error.message)
    }
  }

  async function cargarHeatmapNoEfectivos() {
    setLoadingHeatmap(true)
    try {
      const { data: proyectos, error: projErr } = await supabase
        .from('proyectos')
        .select('nombre, estado')

      if (projErr) {
        toast.error('Error cargando proyectos: ' + projErr.message)
        setHeatmapRows([])
        return
      }

      const proyectosNoEfectivo = new Set(
        (proyectos || [])
          .filter((p) => ESTADOS_HEATMAP.has(normalizarEstadoProyecto(p.estado)))
          .map((p) => p.nombre)
      )

      if (proyectosNoEfectivo.size === 0) {
        setHeatmapRows([])
        return
      }

      const PAGE = 1000
      let todas = [], from = 0
      while (true) {
        const { data, error } = await supabase
          .from('horas_proyectadas')
          .select('colaborador, proyecto, mes, horas')
          .range(from, from + PAGE - 1)
        if (error) { toast.error('Error cargando HH: ' + error.message); setHeatmapRows([]); return }
        todas = [...todas, ...(data || [])]
        if (!data || data.length < PAGE) break
        from += PAGE
      }

      const añoActual = new Date().getFullYear()
      const acumulado = {}

      for (const f of todas) {
        if (!proyectosNoEfectivo.has(f.proyecto)) continue
        const [parte, añoCorto] = (f.mes || '').split('-')
        const añoFull = parseInt(añoCorto || '0') + (parseInt(añoCorto || '0') < 100 ? 2000 : 0)
        if (añoFull !== añoActual) continue
        const idx = MESES_ORDEN.indexOf((parte || '').slice(0, 3).toLowerCase())
        if (idx < 0) continue
        const mesNombre = MESES_HH_ALL[idx]
        if (!acumulado[f.colaborador]) {
          acumulado[f.colaborador] = { colaborador: f.colaborador }
          MESES_HH_ALL.forEach((m) => { acumulado[f.colaborador][m] = 0 })
        }
        acumulado[f.colaborador][mesNombre] = (acumulado[f.colaborador][mesNombre] || 0) + (parseFloat(f.horas) || 0)
      }

      const filas = Object.values(acumulado).map((r) => ({
        ...r,
        total: MESES_HH_VIEW.reduce((sum, m) => sum + (r[m] || 0), 0)
      }))
      filas.sort((a, b) => (b.total || 0) - (a.total || 0))
      setHeatmapRows(filas)
    } catch (err) {
      toast.error('Error cargando heatmap: ' + err.message)
      setHeatmapRows([])
    } finally {
      setLoadingHeatmap(false)
    }
  }

  const heatmapMax = useMemo(() => {
    const maxByMonth = {}
    MESES_HH_VIEW.forEach((mes) => {
      maxByMonth[mes] = 0
    })
    let maxTotal = 0
    heatmapRows.forEach((row) => {
      MESES_HH_VIEW.forEach((mes) => {
        const value = row[mes] || 0
        if (value > maxByMonth[mes]) maxByMonth[mes] = value
      })
      if ((row.total || 0) > maxTotal) maxTotal = row.total || 0
    })
    return { byMonth: maxByMonth, total: maxTotal }
  }, [heatmapRows])

  function aplicarComandoTexto(comando, valor = null) {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(comando, false, valor)
    setNotas(editorRef.current.innerHTML)
  }

  function aplicarComandoTextoSens(comando, valor = null) {
    if (!editorSensRef.current) return
    editorSensRef.current.focus()
    document.execCommand(comando, false, valor)
    setNotasSens(editorSensRef.current.innerHTML)
  }

  function onEditorInput() {
    if (!editorRef.current) return
    setNotas(editorRef.current.innerHTML)
  }

  function onEditorSensInput() {
    if (!editorSensRef.current) return
    setNotasSens(editorSensRef.current.innerHTML)
  }

  function setFiltroPipeline(col, valor) {
    setFiltrosPipeline((prev) => ({ ...prev, [col]: valor }))
  }

  function toggleOrdenPipeline(col) {
    if (ordenPipelineCol === col) {
      setOrdenPipelineDir(ordenPipelineDir === 'asc' ? 'desc' : 'asc')
    } else {
      setOrdenPipelineCol(col)
      setOrdenPipelineDir('asc')
    }
  }

  function readNormalizedRow(row) {
    const normalized = {}
    Object.keys(row || {}).forEach((key) => {
      normalized[normalizeKey(key)] = row[key]
    })
    return normalized
  }

  function buildRowPayload(rawRow) {
    const row = readNormalizedRow(rawRow)
    const linea = getValueFromRow(row, HEADER_KEYS.linea)

    return {
      linea: linea ? String(linea).trim() : '',
      real: {
        ingresos: parseNumber(getValueFromRow(row, HEADER_KEYS.real.ingresos)),
        hh: parseNumber(getValueFromRow(row, HEADER_KEYS.real.hh)),
        gasto: parseNumber(getValueFromRow(row, HEADER_KEYS.real.gasto)),
        margen: parseNumber(getValueFromRow(row, HEADER_KEYS.real.margen))
      },
      ppto: {
        ingresos: parseNumber(getValueFromRow(row, HEADER_KEYS.ppto.ingresos)),
        hh: parseNumber(getValueFromRow(row, HEADER_KEYS.ppto.hh)),
        gasto: parseNumber(getValueFromRow(row, HEADER_KEYS.ppto.gasto)),
        margen: parseNumber(getValueFromRow(row, HEADER_KEYS.ppto.margen))
      }
    }
  }

  function buildDataFromRows(data) {
    const lineasOrdenadas = lineasUnicas.map((linea) => linea.linea)
    const nuevaData = {}

    data.forEach((rawRow, index) => {
      const payload = buildRowPayload(rawRow)
      let lineaNombre = payload.linea

      if (!lineaNombre && lineasOrdenadas[index]) {
        lineaNombre = lineasOrdenadas[index]
      }

      if (!lineaNombre) return

      const key = normalizeLinea(lineaNombre)
      nuevaData[key] = {
        linea: lineaNombre,
        real: payload.real,
        ppto: payload.ppto
      }
    })

    return nuevaData
  }

  const hhRealPorLinea = useMemo(() => {
    const result = {}
    for (const p of allProyectos) {
      if (!p.ceco) continue
      const hh = costoPorProyectoReal[normalizeKey(p.nombre)] || 0
      if (!hh) continue
      const lineaKey = normalizeLinea(p.ceco)
      result[lineaKey] = (result[lineaKey] || 0) + hh
    }
    return result
  }, [allProyectos, costoPorProyectoReal])

  const ingresoRealPorLinea = useMemo(() => {
    const result = {}
    for (const p of allProyectos) {
      if (!p.ceco) continue
      const ing = ingresoRealMap[normalizeKey(p.nombre)] || 0
      if (!ing) continue
      const lineaKey = normalizeLinea(p.ceco)
      result[lineaKey] = (result[lineaKey] || 0) + ing
    }
    return result
  }, [allProyectos, ingresoRealMap])

  const gastoRealPorLinea = useMemo(() => {
    const result = {}
    for (const p of allProyectos) {
      if (!p.ceco) continue
      const gasto = gastoRealMap[normalizeKey(p.nombre)] || 0
      if (!gasto) continue
      const lineaKey = normalizeLinea(p.ceco)
      result[lineaKey] = (result[lineaKey] || 0) + gasto
    }
    return result
  }, [allProyectos, gastoRealMap])

  const rows = useMemo(() => {
    return lineasUnicas.map((linea) => {
      const key = normalizeLinea(linea.linea)
      const payload = dataByLinea[key] || buildEmptyMetrics()
      return {
        linea: linea.linea,
        real: {
          ...payload.real,
          ingresos: ingresoRealPorLinea[key] ?? null,
          hh: hhRealPorLinea[key] ?? null,
          gasto: gastoRealPorLinea[key] ?? null,
        },
        ppto: payload.ppto
      }
    })
  }, [lineasUnicas, dataByLinea, hhRealPorLinea, ingresoRealPorLinea, gastoRealPorLinea])

  const totales = useMemo(() => {
    const total = buildEmptyMetrics()

    rows.forEach((row) => {
      total.real.ingresos = (total.real.ingresos || 0) + (row.real.ingresos || 0)
      total.real.hh = (total.real.hh || 0) + (row.real.hh || 0)
      total.real.gasto = (total.real.gasto || 0) + (row.real.gasto || 0)
      total.real.margen = (total.real.margen || 0) + (row.real.margen || 0)
      total.ppto.ingresos = (total.ppto.ingresos || 0) + (row.ppto.ingresos || 0)
      total.ppto.hh = (total.ppto.hh || 0) + (row.ppto.hh || 0)
      total.ppto.gasto = (total.ppto.gasto || 0) + (row.ppto.gasto || 0)
      total.ppto.margen = (total.ppto.margen || 0) + (row.ppto.margen || 0)
    })

    return total
  }, [rows])

  const diferenciasMax = useMemo(() => {
    const max = { ingresos: 0, hh: 0, gasto: 0, margen: 0 }
    rows.forEach((row) => {
      max.ingresos = Math.max(max.ingresos, Math.abs(diffValue(row.real.ingresos, row.ppto.ingresos) || 0))
      max.hh = Math.max(max.hh, Math.abs(diffValue(row.real.hh, row.ppto.hh) || 0))
      max.gasto = Math.max(max.gasto, Math.abs(diffValue(row.real.gasto, row.ppto.gasto) || 0))
      max.margen = Math.max(max.margen, Math.abs(diffValue(row.real.margen, row.ppto.margen) || 0))
    })
    max.ingresos = Math.max(max.ingresos, Math.abs(diffValue(totales.real.ingresos, totales.ppto.ingresos) || 0))
    max.hh = Math.max(max.hh, Math.abs(diffValue(totales.real.hh, totales.ppto.hh) || 0))
    max.gasto = Math.max(max.gasto, Math.abs(diffValue(totales.real.gasto, totales.ppto.gasto) || 0))
    max.margen = Math.max(max.margen, Math.abs(diffValue(totales.real.margen, totales.ppto.margen) || 0))
    return max
  }, [rows, totales])

  function diffValue(realValue, pptoValue) {
    if (realValue === null && pptoValue === null) return null
    return (realValue || 0) - (pptoValue || 0)
  }

  const opcionesPipeline = useMemo(() => {
    const lineasSet = new Set()
    const proyectosSet = new Set()
    const jefesSet = new Set()
    const estadosSet = new Set()
    const fechasSet = new Set()

    pipeline.forEach((o) => {
      if (o.proyectos?.ceco) lineasSet.add(o.proyectos.ceco)
      if (o.proyectos?.nombre) proyectosSet.add(o.proyectos.nombre)
      if (o.proyectos?.colaboradores?.colaborador) jefesSet.add(o.proyectos.colaboradores.colaborador)
      const estado = normalizarEstadoProyecto(o.proyectos?.estado)
      if (estado) estadosSet.add(estado)
      const fecha = obtenerFechaAdjudicacion(o)
      if (fecha) fechasSet.add(fecha)
    })

    const ordenar = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })
    return {
      linea: [...lineasSet].sort(ordenar),
      proyecto: [...proyectosSet].sort(ordenar),
      jefe: [...jefesSet].sort(ordenar),
      estado: [...estadosSet].sort(ordenar),
      fechaAdjudicacion: [...fechasSet].sort(ordenar),
    }
  }, [pipeline])

  const pipelineFiltrado = useMemo(() => {
    return pipeline.filter((o) => {
      const linea = o.proyectos?.ceco || ''
      const proyecto = o.proyectos?.nombre || ''
      const jefe = o.proyectos?.colaboradores?.colaborador || ''
      const estado = normalizarEstadoProyecto(o.proyectos?.estado) || ''
      const fechaAdjudicacion = obtenerFechaAdjudicacion(o) || ''

      if (filtrosPipeline.linea && filtrosPipeline.linea !== linea) return false
      if (filtrosPipeline.proyecto && filtrosPipeline.proyecto !== proyecto) return false
      if (filtrosPipeline.jefe && filtrosPipeline.jefe !== jefe) return false
      if (filtrosPipeline.estado && filtrosPipeline.estado !== estado) return false
      if (filtrosPipeline.fechaAdjudicacion && filtrosPipeline.fechaAdjudicacion !== fechaAdjudicacion) return false
      return true
    })
  }, [pipeline, filtrosPipeline])

  const pipelineOrdenado = useMemo(() => {
    if (!ordenPipelineCol) return pipelineFiltrado
    const datos = [...pipelineFiltrado]
    datos.sort((a, b) => {
      let vA
      let vB
      switch (ordenPipelineCol) {
        case 'linea':
          vA = a.proyectos?.ceco || ''
          vB = b.proyectos?.ceco || ''
          break
        case 'proyecto':
          vA = a.proyectos?.nombre || ''
          vB = b.proyectos?.nombre || ''
          break
        case 'jefe':
          vA = a.proyectos?.colaboradores?.colaborador || ''
          vB = b.proyectos?.colaboradores?.colaborador || ''
          break
        case 'ingresos':
          vA = parseFloat(a.ingresos) || 0
          vB = parseFloat(b.ingresos) || 0
          break
        case 'hh':
          vA = costoPorProyecto[normalizeKey(a.proyectos?.nombre || '')] || 0
          vB = costoPorProyecto[normalizeKey(b.proyectos?.nombre || '')] || 0
          break
        case 'gastos':
          vA = parseFloat(a.gastos) || 0
          vB = parseFloat(b.gastos) || 0
          break
        case 'margen': {
          const aIng = parseFloat(a.ingresos) || 0
          const aHh = costoPorProyecto[normalizeKey(a.proyectos?.nombre || '')] || 0
          const aGasto = parseFloat(a.gastos) || 0
          const bIng = parseFloat(b.ingresos) || 0
          const bHh = costoPorProyecto[normalizeKey(b.proyectos?.nombre || '')] || 0
          const bGasto = parseFloat(b.gastos) || 0
          vA = aIng - aHh - aGasto
          vB = bIng - bHh - bGasto
          break
        }
        case 'estado':
          vA = normalizarEstadoProyecto(a.proyectos?.estado) || ''
          vB = normalizarEstadoProyecto(b.proyectos?.estado) || ''
          break
        case 'fechaAdjudicacion':
          vA = obtenerFechaAdjudicacion(a) || ''
          vB = obtenerFechaAdjudicacion(b) || ''
          break
        default:
          vA = ''
          vB = ''
      }
      if (typeof vA === 'string') vA = vA.toLowerCase()
      if (typeof vB === 'string') vB = vB.toLowerCase()
      if (vA < vB) return ordenPipelineDir === 'asc' ? -1 : 1
      if (vA > vB) return ordenPipelineDir === 'asc' ? 1 : -1
      return 0
    })
    return datos
  }, [pipelineFiltrado, ordenPipelineCol, ordenPipelineDir])

  const totalesPipeline = useMemo(() => {
    return pipelineOrdenado.reduce(
      (acc, o) => {
        const ingresos = parseFloat(o.ingresos) || 0
        const hh = costoPorProyecto[normalizeKey(o.proyectos?.nombre || '')] || 0
        const gastos = parseFloat(o.gastos) || 0
        acc.ingresos += ingresos
        acc.hh += hh
        acc.gastos += gastos
        acc.margen += ingresos - hh - gastos
        return acc
      },
      { ingresos: 0, hh: 0, gastos: 0, margen: 0 }
    )
  }, [pipelineOrdenado, costoPorProyecto])

  // HH por línea = suma de costoPorProyecto de todos los proyectos de esa línea
  // Mismo dato que muestra la tabla de proyectos, agregado por ceco
  const hhPorLinea = useMemo(() => {
    const result = {}
    for (const p of allProyectos) {
      if (!p.ceco) continue
      const hh = costoPorProyecto[normalizeKey(p.nombre)] || 0
      if (!hh) continue
      const lineaKey = normalizeLinea(p.ceco)
      result[lineaKey] = (result[lineaKey] || 0) + hh
    }
    return result
  }, [allProyectos, costoPorProyecto])

  const sensibilidadPorLinea = useMemo(() => {
    const lineasDisponibles = new Set(lineasUnicas.map((l) => normalizeLinea(l.linea)))
    const acumulado = {}

    // Paso 1: ingReal + gastoReal de TODOS los proyectos (sin filtro de estado)
    allProyectos.forEach((p) => {
      const linea = p.ceco || ''
      const key = normalizeLinea(linea)
      if (!key || !lineasDisponibles.has(key)) return
      const pKey = normalizeKey(p.nombre || '')
      const ingReal = ingresoRealMap[pKey] || 0
      const gastoReal = gastoRealMap[pKey] || 0
      if (!ingReal && !gastoReal) return
      if (!acumulado[key]) acumulado[key] = { linea, ingresos: 0, hh: 0, gasto: 0, margen: 0 }
      acumulado[key].ingresos += ingReal
      acumulado[key].gasto += gastoReal
    })

    // Paso 2: porIngresar + porGastar solo de Efectivo y Adjudicado
    allProyectos.forEach((p) => {
      const estado = normalizarEstadoProyecto(p.estado) || ''
      if (estado !== 'Efectivo' && estado !== 'Adjudicado') return
      const linea = p.ceco || ''
      const key = normalizeLinea(linea)
      if (!key || !lineasDisponibles.has(key)) return
      if (!acumulado[key]) acumulado[key] = { linea, ingresos: 0, hh: 0, gasto: 0, margen: 0 }
      acumulado[key].ingresos += parseFloat(p.ingresos) || 0
      acumulado[key].gasto += parseFloat(p.gastos) || 0
    })

    // HH de todos los estados agrupado por línea
    for (const key of Object.keys(acumulado)) {
      const hh = hhPorLinea[key] || 0
      acumulado[key].hh = hh
      acumulado[key].margen = acumulado[key].ingresos - hh - acumulado[key].gasto
    }
    return acumulado
  }, [allProyectos, lineasUnicas, hhPorLinea, ingresoRealMap, gastoRealMap])

  const sensibilidadRows = useMemo(() => {
    return lineasUnicas.map((linea) => {
      const key = normalizeLinea(linea.linea)
      const presupuesto = presupuestoLineas[key] || { linea: linea.linea, ingresos: 0, hh: 0, gasto: 0, margen: 0 }
      const sensibilidad = sensibilidadPorLinea[key] || { linea: linea.linea, ingresos: 0, hh: 0, gasto: 0, margen: 0 }
      return {
        linea: linea.linea,
        presupuesto,
        sensibilidad,
        diferencias: {
          ingresos: sensibilidad.ingresos - presupuesto.ingresos,
          hh: sensibilidad.hh - presupuesto.hh,
          gasto: sensibilidad.gasto - presupuesto.gasto,
          margen: sensibilidad.margen - presupuesto.margen,
        },
      }
    })
  }, [lineasUnicas, presupuestoLineas, sensibilidadPorLinea])

  const sensibilidadTotales = useMemo(() => {
    return sensibilidadRows.reduce(
      (acc, row) => {
        acc.presupuesto.ingresos += row.presupuesto.ingresos
        acc.presupuesto.hh += row.presupuesto.hh
        acc.presupuesto.gasto += row.presupuesto.gasto
        acc.presupuesto.margen += row.presupuesto.margen
        acc.sensibilidad.ingresos += row.sensibilidad.ingresos
        acc.sensibilidad.hh += row.sensibilidad.hh
        acc.sensibilidad.gasto += row.sensibilidad.gasto
        acc.sensibilidad.margen += row.sensibilidad.margen
        acc.diferencias.ingresos += row.diferencias.ingresos
        acc.diferencias.hh += row.diferencias.hh
        acc.diferencias.gasto += row.diferencias.gasto
        acc.diferencias.margen += row.diferencias.margen
        return acc
      },
      {
        presupuesto: { ingresos: 0, hh: 0, gasto: 0, margen: 0 },
        sensibilidad: { ingresos: 0, hh: 0, gasto: 0, margen: 0 },
        diferencias: { ingresos: 0, hh: 0, gasto: 0, margen: 0 },
      }
    )
  }, [sensibilidadRows])

  const sensibilidadDiffMax = useMemo(() => {
    const max = { ingresos: 0, hh: 0, gasto: 0, margen: 0 }
    sensibilidadRows.forEach((row) => {
      max.ingresos = Math.max(max.ingresos, Math.abs(row.diferencias.ingresos || 0))
      max.hh = Math.max(max.hh, Math.abs(row.diferencias.hh || 0))
      max.gasto = Math.max(max.gasto, Math.abs(row.diferencias.gasto || 0))
      max.margen = Math.max(max.margen, Math.abs(row.diferencias.margen || 0))
    })
    max.ingresos = Math.max(max.ingresos, Math.abs(sensibilidadTotales.diferencias.ingresos || 0))
    max.hh = Math.max(max.hh, Math.abs(sensibilidadTotales.diferencias.hh || 0))
    max.gasto = Math.max(max.gasto, Math.abs(sensibilidadTotales.diferencias.gasto || 0))
    max.margen = Math.max(max.margen, Math.abs(sensibilidadTotales.diferencias.margen || 0))
    return max
  }, [sensibilidadRows, sensibilidadTotales])

  const todosPorLinea = useMemo(() => {
    const acumulado = {}
    allProyectos.forEach((p) => {
      const estado = normalizarEstadoProyecto(p.estado) || ''
      if (!ESTADOS_TODOS_SIN_CANCELADO.has(estado)) return
      const linea = p.ceco || ''
      const key = normalizeLinea(linea)
      const pKey = normalizeKey(p.nombre || '')
      const ingresos = (ingresoRealMap[pKey] || 0) + (parseFloat(p.ingresos) || 0)
      const gastos = (gastoRealMap[pKey] || 0) + (parseFloat(p.gastos) || 0)
      if (!acumulado[key]) {
        acumulado[key] = { linea, ingresos: 0, hh: 0, gasto: 0, margen: 0 }
      }
      acumulado[key].ingresos += ingresos
      acumulado[key].gasto += gastos
    })
    for (const key of Object.keys(acumulado)) {
      const hh = hhPorLinea[key] || 0
      acumulado[key].hh = hh
      acumulado[key].margen = acumulado[key].ingresos - hh - acumulado[key].gasto
    }
    return acumulado
  }, [allProyectos, hhPorLinea, ingresoRealMap, gastoRealMap])

  const todosRows = useMemo(() => {
    return lineasUnicas.map((linea) => {
      const key = normalizeLinea(linea.linea)
      const presupuesto = presupuestoLineas[key] || { linea: linea.linea, ingresos: 0, hh: 0, gasto: 0, margen: 0 }
      const todos = todosPorLinea[key] || { linea: linea.linea, ingresos: 0, hh: 0, gasto: 0, margen: 0 }
      return {
        linea: linea.linea,
        presupuesto,
        todos,
        diferencias: {
          ingresos: todos.ingresos - presupuesto.ingresos,
          hh: todos.hh - presupuesto.hh,
          gasto: todos.gasto - presupuesto.gasto,
          margen: todos.margen - presupuesto.margen,
        },
      }
    })
  }, [lineasUnicas, presupuestoLineas, todosPorLinea])

  const todosTotales = useMemo(() => {
    const presupuesto = todosRows.reduce(
      (acc, row) => {
        acc.ingresos += row.presupuesto.ingresos
        acc.hh += row.presupuesto.hh
        acc.gasto += row.presupuesto.gasto
        acc.margen += row.presupuesto.margen
        return acc
      },
      { ingresos: 0, hh: 0, gasto: 0, margen: 0 }
    )
    const todos = Object.values(todosPorLinea).reduce(
      (acc, row) => {
        acc.ingresos += row.ingresos
        acc.hh += row.hh
        acc.gasto += row.gasto
        acc.margen += row.margen
        return acc
      },
      { ingresos: 0, hh: 0, gasto: 0, margen: 0 }
    )
    return {
      presupuesto,
      todos,
      diferencias: {
        ingresos: todos.ingresos - presupuesto.ingresos,
        hh: todos.hh - presupuesto.hh,
        gasto: todos.gasto - presupuesto.gasto,
        margen: todos.margen - presupuesto.margen,
      },
    }
  }, [todosRows, todosPorLinea])

  const todosDiffMax = useMemo(() => {
    const max = { ingresos: 0, hh: 0, gasto: 0, margen: 0 }
    todosRows.forEach((row) => {
      max.ingresos = Math.max(max.ingresos, Math.abs(row.diferencias.ingresos || 0))
      max.hh = Math.max(max.hh, Math.abs(row.diferencias.hh || 0))
      max.gasto = Math.max(max.gasto, Math.abs(row.diferencias.gasto || 0))
      max.margen = Math.max(max.margen, Math.abs(row.diferencias.margen || 0))
    })
    max.ingresos = Math.max(max.ingresos, Math.abs(todosTotales.diferencias.ingresos || 0))
    max.hh = Math.max(max.hh, Math.abs(todosTotales.diferencias.hh || 0))
    max.gasto = Math.max(max.gasto, Math.abs(todosTotales.diferencias.gasto || 0))
    max.margen = Math.max(max.margen, Math.abs(todosTotales.diferencias.margen || 0))
    return max
  }, [todosRows, todosTotales])

  const detalleVsSensibilidad = useMemo(() => {
    const porLinea = {}
    allProyectos.forEach((p) => {
      const estado = normalizarEstadoProyecto(p.estado) || ''
      if (estado !== 'No Efectivo' && estado !== 'Meta') return
      const lineaRaw = p.ceco || ''
      const key = normalizeLinea(lineaRaw)
      const ingresos = parseFloat(p.ingresos) || 0
      const gastos = parseFloat(p.gastos) || 0
      if (!ingresos && !gastos) return
      if (!porLinea[key]) porLinea[key] = { linea: lineaRaw, proyectos: [] }
      porLinea[key].proyectos.push({
        nombre: p.nombre || '—',
        fecha_adjudicacion: normalizarMesAdjudicacion(p.fecha_adjudicacion) || '—',
        ingresos,
        gastos,
        margen: ingresos - gastos,
      })
    })
    return Object.values(porLinea)
      .map((g) => ({
        ...g,
        subtotal: g.proyectos.reduce((a, p) => ({
          ingresos: a.ingresos + p.ingresos,
          gastos: a.gastos + p.gastos,
          margen: a.margen + p.margen,
        }), { ingresos: 0, gastos: 0, margen: 0 }),
      }))
      .filter((g) => g.proyectos.length > 0)
  }, [allProyectos, ingresoRealMap, gastoRealMap])

  async function exportarReportePDF() {
    if (!reporteRef.current) return

    try {
      const { default: html2canvas } = await import('html2canvas')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const fechaGeneracion = buildPdfDateLabel()
      const titulo = `Reporte Seguimiento Financiero - ${fechaGeneracion}`
      const margin = 24
      const headerH = 24
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const printableWidth = pageWidth - margin * 2
      const printableHeight = pageHeight - margin * 2 - headerH

      const addHeader = () => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(titulo, margin, margin + 10)
      }

      // Medir posiciones de secciones ANTES de tocar estilos
      const container = reporteRef.current
      const sections = Array.from(container.querySelectorAll(':scope > section'))
      const containerTop = container.getBoundingClientRect().top + window.scrollY
      const sectionRanges = sections.map((s) => {
        const r = s.getBoundingClientRect()
        return {
          top: r.top + window.scrollY - containerTop,
          bottom: r.bottom + window.scrollY - containerTop,
        }
      })

      // Forzar fondo blanco y quitar sombras para el render
      const prevContainerBg = container.style.background
      container.style.background = '#ffffff'
      const prevSectionBgs = sections.map((s) => s.style.background)
      const prevSectionShadows = sections.map((s) => s.style.boxShadow)
      sections.forEach((s) => {
        s.style.background = '#ffffff'
        s.style.boxShadow = 'none'
      })

      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el?.dataset?.pdfIgnore === 'true',
        scrollY: -window.scrollY,
      })

      // Restaurar estilos
      container.style.background = prevContainerBg
      sections.forEach((s, i) => {
        s.style.background = prevSectionBgs[i]
        s.style.boxShadow = prevSectionShadows[i]
      })

      // Escala: px de canvas por px de DOM
      const domScale = canvas.width / container.offsetWidth

      // Convertir límites de secciones a px de canvas
      const sectionsPx = sectionRanges.map((r) => ({
        top: Math.round(r.top * domScale),
        bottom: Math.round(r.bottom * domScale),
      }))

      // "Zonas seguras de corte": el espacio entre el bottom de una sección
      // y el top de la siguiente (los márgenes space-y-8)
      // Un corte en Y es seguro si cae en alguno de esos intervalos
      const isSafeCut = (y) => {
        for (let i = 0; i < sectionsPx.length - 1; i++) {
          if (y >= sectionsPx[i].bottom && y <= sectionsPx[i + 1].top) return true
        }
        return false
      }

      // Dado un corte ideal en Y, retrocede hasta la zona segura más cercana
      const bestCutPoint = (idealY) => {
        // Buscar hacia atrás hasta 40% de la página por una zona segura
        const minY = idealY * 0.6
        for (let y = idealY; y >= minY; y--) {
          if (isSafeCut(y)) return y
        }
        return idealY // no hay zona segura, cortar en el punto ideal
      }

      // Generar páginas
      addHeader()
      let rendered = 0
      let firstPage = true

      while (rendered < canvas.height) {
        if (!firstPage) {
          doc.addPage()
          addHeader()
        }
        firstPage = false

        const curY = margin + headerH
        const availablePt = pageHeight - margin - curY
        const availablePx = Math.floor(canvas.width * availablePt / printableWidth)
        const remaining = canvas.height - rendered
        let sliceH

        if (remaining <= availablePx) {
          sliceH = remaining
        } else {
          const idealCut = rendered + availablePx
          sliceH = bestCutPoint(idealCut) - rendered
          if (sliceH <= 0) sliceH = availablePx // fallback
        }

        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = sliceH
        sliceCanvas.getContext('2d').drawImage(
          canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH
        )
        const slicePt = sliceH * printableWidth / canvas.width
        doc.addImage(sliceCanvas.toDataURL('image/jpeg', 0.85), 'JPEG', margin, curY, printableWidth, slicePt)

        rendered += sliceH
      }

      doc.save(`seguimiento_financiero_${buildPdfFileTimestamp()}.pdf`)
    } catch (error) {
      toast.error('Error exportando PDF: ' + error.message)
    }
  }

  return (
    <div ref={reporteRef} className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Seguimiento Financiero</h2>
        <button
          type="button"
          onClick={exportarReportePDF}
          data-pdf-ignore="true"
          className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90 self-start md:self-auto"
          style={{ backgroundColor: '#FF5100' }}
        >
          Exportar PDF
        </button>
      </div>

      <section className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-gray-800">Seguimiento Operacional</h3>
          <div className="relative group">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-400 text-gray-600 text-xs font-bold cursor-default">?</span>
            <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-96 rounded-md bg-gray-800 text-white text-xs p-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              Se carga desde /public/seguimiento_operacional.xlsx. Columnas: linea, ing_real, hh_real, ggoo_real, mg_real, ing_ppto, hh_ppto, ggoo_ppto, mg_ppto. Si falta la linea, se usa el orden de la tabla Lineas.
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed text-sm">
            <thead>
              <tr>
                <th className="border border-gray-300 text-white px-2 py-2 text-left" rowSpan={2} style={{ width: '220px', backgroundColor: '#F47B00' }}>
                  Línea
                </th>
                <th className="border border-gray-300 text-white px-2 py-2 text-center whitespace-nowrap" colSpan={4} style={{ backgroundColor: '#F47B00' }}>
                  Real a la fecha
                </th>
                <th className="border border-gray-300 text-white px-2 py-2 text-center whitespace-nowrap" colSpan={4} style={{ backgroundColor: '#6B6B6B' }}>
                  Ppto a la fecha
                </th>
                <th className="border border-gray-300 text-white px-2 py-2 text-center whitespace-nowrap" colSpan={4} style={{ backgroundColor: '#222222' }}>
                  Diferencias
                </th>
              </tr>
              <tr>
                {['Ing', 'HH', 'Gasto', 'Mg'].map((label) => (
                  <th key={`real-${label}`} className="border border-gray-300 text-white px-1 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#F47B00' }}>
                    {label}
                  </th>
                ))}
                {['Ing', 'HH', 'Gasto', 'Mg'].map((label) => (
                  <th key={`ppto-${label}`} className="border border-gray-300 text-white px-1 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#6B6B6B' }}>
                    {label}
                  </th>
                ))}
                {['Ing', 'HH', 'Gasto', 'Mg'].map((label) => (
                  <th key={`diff-${label}`} className="border border-gray-300 text-white px-1 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#222222' }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.linea}>
                  <td className="border border-gray-300 px-2 py-2 font-medium text-gray-700 break-words" style={{ width: '220px' }}>
                    {row.linea}
                  </td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.real.ingresos)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.real.hh)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.real.gasto)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(row.real.margen)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.ppto.ingresos)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.ppto.hh)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.ppto.gasto)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(row.ppto.margen)}</td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(diffValue(row.real.ingresos, row.ppto.ingresos), diferenciasMax.ingresos)}
                  >
                    {formatNumber(diffValue(row.real.ingresos, row.ppto.ingresos))}
                  </td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(diffValue(row.real.hh, row.ppto.hh), diferenciasMax.hh, true)}
                  >
                    {formatNumber(diffValue(row.real.hh, row.ppto.hh))}
                  </td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(diffValue(row.real.gasto, row.ppto.gasto), diferenciasMax.gasto, true)}
                  >
                    {formatNumber(diffValue(row.real.gasto, row.ppto.gasto))}
                  </td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(diffValue(row.real.margen, row.ppto.margen), diferenciasMax.margen)}
                  >
                    {formatNumber(diffValue(row.real.margen, row.ppto.margen))}
                  </td>
                </tr>
              ))}
              <tr className="bg-green-100 font-semibold">
                <td className="border border-gray-300 px-2 py-2">TOTAL</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(totales.real.ingresos)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(totales.real.hh)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(totales.real.gasto)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(totales.real.margen)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(totales.ppto.ingresos)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(totales.ppto.hh)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(totales.ppto.gasto)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(totales.ppto.margen)}</td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(diffValue(totales.real.ingresos, totales.ppto.ingresos), diferenciasMax.ingresos)}
                >
                  {formatNumber(diffValue(totales.real.ingresos, totales.ppto.ingresos))}
                </td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(diffValue(totales.real.hh, totales.ppto.hh), diferenciasMax.hh, true)}
                >
                  {formatNumber(diffValue(totales.real.hh, totales.ppto.hh))}
                </td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(diffValue(totales.real.gasto, totales.ppto.gasto), diferenciasMax.gasto, true)}
                >
                  {formatNumber(diffValue(totales.real.gasto, totales.ppto.gasto))}
                </td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(diffValue(totales.real.margen, totales.ppto.margen), diferenciasMax.margen)}
                >
                  {formatNumber(diffValue(totales.real.margen, totales.ppto.margen))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Observaciones
          </label>
          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
            <button type="button" onClick={() => aplicarComandoTexto('bold')} className="px-2 py-1 rounded text-white" style={{ backgroundColor: '#00334A' }}>Negrita</button>
            <button type="button" onClick={() => aplicarComandoTexto('italic')} className="px-2 py-1 rounded text-white" style={{ backgroundColor: '#009ADE' }}>Italica</button>
            <button type="button" onClick={() => aplicarComandoTexto('underline')} className="px-2 py-1 rounded text-white" style={{ backgroundColor: '#86C300' }}>Subrayado</button>
            <select
              className="px-2 py-1 border border-gray-300 rounded bg-white"
              onChange={(e) => aplicarComandoTexto('fontSize', e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Tamano</option>
              <option value="2">Pequeno</option>
              <option value="3">Normal</option>
              <option value="4">Medio</option>
              <option value="5">Grande</option>
            </select>
            <input
              type="color"
              aria-label="Color"
              onChange={(e) => aplicarComandoTexto('foreColor', e.target.value)}
              className="h-8 w-10 border border-gray-300 rounded"
            />
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={onEditorInput}
            className="w-full min-h-[160px] resize-y rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          />
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Analisis de Pipeline (Proyectos no efectivos y efectivos por adjudicar)</h3>

        {loadingPipeline ? (
          <div className="text-center py-8 text-gray-500">Cargando oportunidades...</div>
        ) : pipeline.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No hay oportunidades en estado Efectivo o No Efectivo.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                  <FilterableTh col="linea" label="Línea" align="left" style={{ width: '130px' }} opciones={opcionesPipeline.linea} filtro={filtrosPipeline.linea || ''} onFiltro={setFiltroPipeline} dropdownAbierto={dropdownPipeline==='linea'} onToggleDropdown={setDropdownPipeline} sortable ordenActiva={ordenPipelineCol==='linea'} ordenDir={ordenPipelineDir} onOrdenar={toggleOrdenPipeline} />
                  <FilterableTh col="proyecto" label="Proyecto" align="left" opciones={opcionesPipeline.proyecto} filtro={filtrosPipeline.proyecto || ''} onFiltro={setFiltroPipeline} dropdownAbierto={dropdownPipeline==='proyecto'} onToggleDropdown={setDropdownPipeline} sortable ordenActiva={ordenPipelineCol==='proyecto'} ordenDir={ordenPipelineDir} onOrdenar={toggleOrdenPipeline} />
                  <FilterableTh col="jefe" label="Jefe" align="left" style={{ width: '140px' }} opciones={opcionesPipeline.jefe} filtro={filtrosPipeline.jefe || ''} onFiltro={setFiltroPipeline} dropdownAbierto={dropdownPipeline==='jefe'} onToggleDropdown={setDropdownPipeline} sortable ordenActiva={ordenPipelineCol==='jefe'} ordenDir={ordenPipelineDir} onOrdenar={toggleOrdenPipeline} />
                  <FilterableTh col="ingresos" label="Ingresos" align="right" style={{ width: '110px' }} opciones={[]} filtro={[]} onFiltro={() => {}} dropdownAbierto={false} onToggleDropdown={() => {}} sortable ordenActiva={ordenPipelineCol==='ingresos'} ordenDir={ordenPipelineDir} onOrdenar={toggleOrdenPipeline} />
                  <FilterableTh col="hh" label="HH" align="right" style={{ width: '110px' }} opciones={[]} filtro={[]} onFiltro={() => {}} dropdownAbierto={false} onToggleDropdown={() => {}} sortable ordenActiva={ordenPipelineCol==='hh'} ordenDir={ordenPipelineDir} onOrdenar={toggleOrdenPipeline} />
                  <FilterableTh col="gastos" label="GGOO" align="right" style={{ width: '110px' }} opciones={[]} filtro={[]} onFiltro={() => {}} dropdownAbierto={false} onToggleDropdown={() => {}} sortable ordenActiva={ordenPipelineCol==='gastos'} ordenDir={ordenPipelineDir} onOrdenar={toggleOrdenPipeline} />
                  <FilterableTh col="margen" label="Margen" align="right" style={{ width: '110px' }} opciones={[]} filtro={[]} onFiltro={() => {}} dropdownAbierto={false} onToggleDropdown={() => {}} sortable ordenActiva={ordenPipelineCol==='margen'} ordenDir={ordenPipelineDir} onOrdenar={toggleOrdenPipeline} />
                  <FilterableTh col="estado" label="Estado" align="center" style={{ width: '130px' }} opciones={opcionesPipeline.estado} filtro={filtrosPipeline.estado || ''} onFiltro={setFiltroPipeline} dropdownAbierto={dropdownPipeline==='estado'} onToggleDropdown={setDropdownPipeline} sortable ordenActiva={ordenPipelineCol==='estado'} ordenDir={ordenPipelineDir} onOrdenar={toggleOrdenPipeline} />
                  <FilterableTh
                    col="fechaAdjudicacion"
                    label="Fecha de adjudicación"
                    align="center"
                    style={{ width: '170px' }}
                    opciones={opcionesPipeline.fechaAdjudicacion}
                    filtro={filtrosPipeline.fechaAdjudicacion || ''}
                    onFiltro={setFiltroPipeline}
                    dropdownAbierto={dropdownPipeline==='fechaAdjudicacion'}
                    onToggleDropdown={setDropdownPipeline}
                    sortable
                    ordenActiva={ordenPipelineCol==='fechaAdjudicacion'}
                    ordenDir={ordenPipelineDir}
                    onOrdenar={toggleOrdenPipeline}
                  />
                </tr>
              </thead>
              <tbody>
                {pipelineOrdenado.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-gray-400 italic">Sin resultados para el filtro aplicado.</td>
                  </tr>
                )}
                {pipelineOrdenado.map((o) => {
                  const ingresos = parseFloat(o.ingresos) || 0
                  const hh = costoPorProyecto[normalizeKey(o.proyectos?.nombre || '')] || 0
                  const gastos = parseFloat(o.gastos) || 0
                  const margen = ingresos - hh - gastos
                  const estado = normalizarEstadoProyecto(o.proyectos?.estado) || ''
                  const fechaAdjudicacion = obtenerFechaAdjudicacion(o)
                  return (
                    <tr key={o.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                      <td className="py-3 px-4 text-gray-600 text-sm max-w-[180px] truncate" title={o.proyectos?.ceco || ''}>
                        {o.proyectos?.ceco || <span className="text-gray-400 italic">-</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-800 font-medium text-sm">
                        {o.proyectos?.nombre || 'Sin proyecto'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm truncate" title={o.proyectos?.colaboradores?.colaborador || ''}>
                        {o.proyectos?.colaboradores?.colaborador || <span className="text-gray-400 italic">-</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatNumber(ingresos)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatNumber(hh)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatNumber(gastos)}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(margen)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {estado || '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {fechaAdjudicacion || '-'}
                      </td>
                    </tr>
                  )
                })}
                {pipelineOrdenado.length > 0 && (
                  <tr className="bg-green-100 font-semibold">
                    <td className="py-3 px-4 text-gray-700">TOTAL</td>
                    <td className="py-3 px-4"></td>
                    <td className="py-3 px-4"></td>
                    <td className="py-3 px-4 text-right">{formatNumber(totalesPipeline.ingresos)}</td>
                    <td className="py-3 px-4 text-right">{formatNumber(totalesPipeline.hh)}</td>
                    <td className="py-3 px-4 text-right">{formatNumber(totalesPipeline.gastos)}</td>
                    <td className="py-3 px-4 text-right">{formatNumber(totalesPipeline.margen)}</td>
                    <td className="py-3 px-4 text-center"></td>
                    <td className="py-3 px-4 text-center text-sm"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-gray-800">Analisis de sensibilidad</h3>
          <div className="relative group">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-400 text-gray-600 text-xs font-bold cursor-default">?</span>
            <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-[420px] rounded-md bg-gray-800 text-white text-xs p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 space-y-2">
              <p className="font-bold text-sm border-b border-gray-600 pb-1">Reglas — Análisis de Sensibilidad</p>
              <p><span className="font-semibold text-gray-300">Presupuesto:</span> leído de /public/ppto2026.xlsx, sumado por línea.</p>
              <p><span className="font-semibold text-gray-300">HH:</span> suma costo de horas proyectadas (horas × costo colaborador) agrupado por línea, para todos los proyectos.</p>
              <p className="font-semibold text-gray-300 pt-1">Estados y su efecto:</p>
              <ul className="space-y-1 pl-1">
                <li><span className="text-green-400 font-semibold">Efectivo</span> → suma Ingresos y GGOO</li>
                <li><span className="text-blue-400 font-semibold">Adjudicado</span> → suma Ingresos y GGOO</li>
                <li><span className="text-gray-400 font-semibold">Cancelado</span> → Ingresos y GGOO se omiten</li>
                <li><span className="text-purple-400 font-semibold">Meta</span> → Ingresos y GGOO se omiten</li>
                <li><span className="text-red-400 font-semibold">No Efectivo</span> → no aparece en sensibilidad</li>
              </ul>
              <p className="text-gray-400 italic">HH suma todos los estados sin excepción.</p>
              <p className="border-t border-gray-600 pt-1"><span className="font-semibold text-gray-300">Margen:</span> Ingresos − HH − GGOO</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-300 text-white px-2 py-2 text-left" rowSpan={2} style={{ width: '220px', backgroundColor: '#006E5E' }}>
                  Linea
                </th>
                <th className="border border-gray-300 text-white px-2 py-2 text-center" colSpan={4} style={{ backgroundColor: '#0F7D69' }}>
                  Presupuesto 2026
                </th>
                <th className="border border-gray-300 text-white px-2 py-2 text-center" colSpan={4} style={{ backgroundColor: '#6B6B6B' }}>
                  Analisis de Sensibilidad
                </th>
                <th className="border border-gray-300 text-white px-2 py-2 text-center" colSpan={4} style={{ backgroundColor: '#1F3A5A' }}>
                  Diferencias
                </th>
              </tr>
              <tr>
                {['Ing', 'HH', 'Gasto', 'Mg'].map((label) => (
                  <th key={`ppto-${label}`} className="border border-gray-300 text-white px-1 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#0F7D69' }}>
                    {label}
                  </th>
                ))}
                {['Ing', 'HH', 'Gasto', 'Mg'].map((label) => (
                  <th key={`sens-${label}`} className="border border-gray-300 text-white px-1 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#6B6B6B' }}>
                    {label}
                  </th>
                ))}
                {['Ing', 'HH', 'Gasto', 'Mg'].map((label) => (
                  <th key={`diff-${label}`} className="border border-gray-300 text-white px-1 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#1F3A5A' }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensibilidadRows.map((row) => (
                <tr key={row.linea}>
                  <td className="border border-gray-300 px-2 py-2 font-medium text-gray-700 break-words" style={{ width: '220px' }}>
                    {row.linea}
                  </td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.presupuesto.ingresos)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.presupuesto.hh)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.presupuesto.gasto)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(row.presupuesto.margen)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.sensibilidad.ingresos)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.sensibilidad.hh)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.sensibilidad.gasto)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(row.sensibilidad.margen)}</td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(row.diferencias.ingresos, sensibilidadDiffMax.ingresos)}
                  >
                    {formatNumber(row.diferencias.ingresos)}
                  </td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(row.diferencias.hh, sensibilidadDiffMax.hh, true)}
                  >
                    {formatNumber(row.diferencias.hh)}
                  </td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(row.diferencias.gasto, sensibilidadDiffMax.gasto, true)}
                  >
                    {formatNumber(row.diferencias.gasto)}
                  </td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(row.diferencias.margen, sensibilidadDiffMax.margen)}
                  >
                    {formatNumber(row.diferencias.margen)}
                  </td>
                </tr>
              ))}
              <tr className="bg-green-100 font-semibold">
                <td className="border border-gray-300 px-2 py-2">TOTAL</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(sensibilidadTotales.presupuesto.ingresos)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(sensibilidadTotales.presupuesto.hh)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(sensibilidadTotales.presupuesto.gasto)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(sensibilidadTotales.presupuesto.margen)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(sensibilidadTotales.sensibilidad.ingresos)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(sensibilidadTotales.sensibilidad.hh)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(sensibilidadTotales.sensibilidad.gasto)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(sensibilidadTotales.sensibilidad.margen)}</td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(sensibilidadTotales.diferencias.ingresos, sensibilidadDiffMax.ingresos)}
                >
                  {formatNumber(sensibilidadTotales.diferencias.ingresos)}
                </td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(sensibilidadTotales.diferencias.hh, sensibilidadDiffMax.hh, true)}
                >
                  {formatNumber(sensibilidadTotales.diferencias.hh)}
                </td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(sensibilidadTotales.diferencias.gasto, sensibilidadDiffMax.gasto, true)}
                >
                  {formatNumber(sensibilidadTotales.diferencias.gasto)}
                </td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(sensibilidadTotales.diferencias.margen, sensibilidadDiffMax.margen)}
                >
                  {formatNumber(sensibilidadTotales.diferencias.margen)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Observaciones</h3>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
          <button type="button" onClick={() => aplicarComandoTextoSens('bold')} className="px-2 py-1 rounded text-white" style={{ backgroundColor: '#00334A' }}>Negrita</button>
          <button type="button" onClick={() => aplicarComandoTextoSens('italic')} className="px-2 py-1 rounded text-white" style={{ backgroundColor: '#009ADE' }}>Italica</button>
          <button type="button" onClick={() => aplicarComandoTextoSens('underline')} className="px-2 py-1 rounded text-white" style={{ backgroundColor: '#86C300' }}>Subrayado</button>
          <select
            className="px-2 py-1 border border-gray-300 rounded bg-white"
            onChange={(e) => aplicarComandoTextoSens('fontSize', e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>Tamano</option>
            <option value="2">Pequeno</option>
            <option value="3">Normal</option>
            <option value="4">Medio</option>
            <option value="5">Grande</option>
          </select>
          <input
            type="color"
            aria-label="Color"
            onChange={(e) => aplicarComandoTextoSens('foreColor', e.target.value)}
            className="h-8 w-10 border border-gray-300 rounded"
          />
        </div>
        <div
          ref={editorSensRef}
          contentEditable
          suppressContentEditableWarning
          onInput={onEditorSensInput}
          className="w-full min-h-[160px] resize-y rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
        />
      </section>

      <section className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-gray-800">Proyeccion Total (todos los estados exc. Cancelado)</h3>
          <div className="relative group">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-400 text-gray-600 text-xs font-bold cursor-default">?</span>
            <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-[420px] rounded-md bg-gray-800 text-white text-xs p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 space-y-2">
              <p className="font-bold text-sm border-b border-gray-600 pb-1">Reglas — Proyeccion Total</p>
              <p><span className="font-semibold text-gray-300">Estados incluidos:</span> Efectivo, No Efectivo, Adjudicado y Meta. Se excluye Cancelado.</p>
              <p className="font-semibold text-gray-300 pt-1">Estados y su efecto:</p>
              <ul className="space-y-1 pl-1">
                <li><span className="text-green-400 font-semibold">Efectivo</span> → suma Ingresos y GGOO</li>
                <li><span className="text-blue-400 font-semibold">Adjudicado</span> → suma Ingresos y GGOO</li>
                <li><span className="text-red-400 font-semibold">No Efectivo</span> → suma Ingresos y GGOO</li>
                <li><span className="text-purple-400 font-semibold">Meta</span> → suma Ingresos y GGOO</li>
              </ul>
              <p className="text-gray-400 italic">HH se calcula igual que en Sensibilidad: costo de horas proyectadas agrupado por línea, para todos los proyectos sin excepción de estado.</p>
              <p className="border-t border-gray-600 pt-1"><span className="font-semibold text-gray-300">Margen:</span> Ingresos − HH − GGOO</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-300 text-white px-2 py-2 text-left" rowSpan={2} style={{ width: '220px', backgroundColor: '#006E5E' }}>
                  Linea
                </th>
                <th className="border border-gray-300 text-white px-2 py-2 text-center" colSpan={4} style={{ backgroundColor: '#0F7D69' }}>
                  Presupuesto 2026
                </th>
                <th className="border border-gray-300 text-white px-2 py-2 text-center" colSpan={4} style={{ backgroundColor: '#5B4A8A' }}>
                  Proyeccion Total
                </th>
                <th className="border border-gray-300 text-white px-2 py-2 text-center" colSpan={4} style={{ backgroundColor: '#1F3A5A' }}>
                  Diferencias
                </th>
              </tr>
              <tr>
                {['Ing', 'HH', 'Gasto', 'Mg'].map((label) => (
                  <th key={`ppto-${label}`} className="border border-gray-300 text-white px-1 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#0F7D69' }}>
                    {label}
                  </th>
                ))}
                {['Ing', 'HH', 'Gasto', 'Mg'].map((label) => (
                  <th key={`todos-${label}`} className="border border-gray-300 text-white px-1 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#5B4A8A' }}>
                    {label}
                  </th>
                ))}
                {['Ing', 'HH', 'Gasto', 'Mg'].map((label) => (
                  <th key={`diff-${label}`} className="border border-gray-300 text-white px-1 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#1F3A5A' }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todosRows.map((row) => (
                <tr key={row.linea}>
                  <td className="border border-gray-300 px-2 py-2 font-medium text-gray-700 break-words" style={{ width: '220px' }}>
                    {row.linea}
                  </td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.presupuesto.ingresos)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.presupuesto.hh)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.presupuesto.gasto)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(row.presupuesto.margen)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.todos.ingresos)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.todos.hh)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(row.todos.gasto)}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(row.todos.margen)}</td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(row.diferencias.ingresos, todosDiffMax.ingresos)}
                  >
                    {formatNumber(row.diferencias.ingresos)}
                  </td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(row.diferencias.hh, todosDiffMax.hh, true)}
                  >
                    {formatNumber(row.diferencias.hh)}
                  </td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(row.diferencias.gasto, todosDiffMax.gasto, true)}
                  >
                    {formatNumber(row.diferencias.gasto)}
                  </td>
                  <td
                    className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                    style={diffCellStyle(row.diferencias.margen, todosDiffMax.margen)}
                  >
                    {formatNumber(row.diferencias.margen)}
                  </td>
                </tr>
              ))}
              <tr className="bg-green-100 font-semibold">
                <td className="border border-gray-300 px-2 py-2">TOTAL</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(todosTotales.presupuesto.ingresos)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(todosTotales.presupuesto.hh)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(todosTotales.presupuesto.gasto)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(todosTotales.presupuesto.margen)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(todosTotales.todos.ingresos)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(todosTotales.todos.hh)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap">{formatNumber(todosTotales.todos.gasto)}</td>
                <td className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap border-r-4 border-r-black">{formatNumber(todosTotales.todos.margen)}</td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(todosTotales.diferencias.ingresos, todosDiffMax.ingresos)}
                >
                  {formatNumber(todosTotales.diferencias.ingresos)}
                </td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(todosTotales.diferencias.hh, todosDiffMax.hh, true)}
                >
                  {formatNumber(todosTotales.diferencias.hh)}
                </td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(todosTotales.diferencias.gasto, todosDiffMax.gasto, true)}
                >
                  {formatNumber(todosTotales.diferencias.gasto)}
                </td>
                <td
                  className="border border-gray-300 px-1 py-2 text-center whitespace-nowrap"
                  style={diffCellStyle(todosTotales.diferencias.margen, todosDiffMax.margen)}
                >
                  {formatNumber(todosTotales.diferencias.margen)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {detalleVsSensibilidad.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-bold text-gray-700 mb-2">
              Detalle proyectos No Efectivos y Meta (explican la diferencia de margen vs Sensibilidad)
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Margen = Ingresos − Gastos (sin HH, ya que las HH son iguales en ambas tablas). Incluye No Efectivos y Meta, que en Sensibilidad no suman ingresos/GGOO. La suma por línea cuadra con la diferencia de margen entre Proyección Total y Sensibilidad.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-gray-300 text-white px-2 py-2 text-left" style={{ backgroundColor: '#006E5E', width: '220px' }}>Línea</th>
                    <th className="border border-gray-300 text-white px-2 py-2 text-left" style={{ backgroundColor: '#0F7D69' }}>Proyecto</th>
                    <th className="border border-gray-300 text-white px-2 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#0F7D69' }}>Fecha Adj.</th>
                    <th className="border border-gray-300 text-white px-2 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#5B4A8A' }}>Ingresos</th>
                    <th className="border border-gray-300 text-white px-2 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#5B4A8A' }}>Gastos</th>
                    <th className="border border-gray-300 text-white px-2 py-2 text-center whitespace-nowrap" style={{ backgroundColor: '#1F3A5A' }}>Margen (Ing−Gasto)</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleVsSensibilidad.map((grupo) => (
                    <>
                      {grupo.proyectos.map((p, i) => (
                        <tr key={`${grupo.linea}-${i}`} className="border-b border-gray-200" style={{ backgroundColor: i % 2 === 0 ? '#F8F7FB' : '#FFFFFF' }}>
                          {i === 0 && (
                            <td
                              className="border border-gray-300 px-2 py-2 font-medium text-gray-700 align-top"
                              rowSpan={grupo.proyectos.length + 1}
                              style={{ width: '220px', backgroundColor: '#F0FAF8' }}
                            >
                              {grupo.linea}
                            </td>
                          )}
                          <td className="border border-gray-300 px-2 py-2 text-gray-700">{p.nombre}</td>
                          <td className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap text-gray-600">{p.fecha_adjudicacion}</td>
                          <td className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap">{formatNumber(p.ingresos)}</td>
                          <td className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap">{formatNumber(p.gastos)}</td>
                          <td className={`border border-gray-300 px-2 py-2 text-center whitespace-nowrap font-medium ${p.margen >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatNumber(p.margen)}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold" style={{ backgroundColor: '#E8E4F3' }}>
                        <td className="border border-gray-300 px-2 py-2 text-gray-700 italic" colSpan={2}>Subtotal {grupo.linea}</td>
                        <td className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap">{formatNumber(grupo.subtotal.ingresos)}</td>
                        <td className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap">{formatNumber(grupo.subtotal.gastos)}</td>
                        <td className={`border border-gray-300 px-2 py-2 text-center whitespace-nowrap ${grupo.subtotal.margen >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatNumber(grupo.subtotal.margen)}
                        </td>
                      </tr>
                    </>
                  ))}
                  <tr className="font-bold bg-green-100">
                    <td className="border border-gray-300 px-2 py-2">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-2 text-gray-500 text-xs italic" colSpan={2}>Suma de No Efectivos y Meta</td>
                    <td className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap">
                      {formatNumber(detalleVsSensibilidad.reduce((a, g) => a + g.subtotal.ingresos, 0))}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap">
                      {formatNumber(detalleVsSensibilidad.reduce((a, g) => a + g.subtotal.gastos, 0))}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center whitespace-nowrap">
                      {formatNumber(detalleVsSensibilidad.reduce((a, g) => a + g.subtotal.margen, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-gray-800">Heatmap Asignacion HH a Proyectos No Efectivos y Meta</h3>
          <span
            className="text-xs text-gray-400 cursor-help select-none"
            title="Horas: tabla horas_proyectadas (Supabase), año en curso. Estados incluidos: No Efectivo y Meta."
          >ⓘ</span>
        </div>
        {loadingHeatmap ? (
          <div className="text-center py-8 text-gray-500">Cargando HH proyectadas...</div>
        ) : heatmapRows.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No hay registros para proyectos No Efectivos o Meta.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed text-[11px]">
              <thead>
                <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th className="px-2 py-2 text-left text-gray-800" style={{ width: '220px' }}>Colaborador</th>
                  {MESES_HH_VIEW.map((mes) => (
                    <th key={mes} className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{mes}</th>
                  ))}
                  <th className="px-2 py-2 text-right text-gray-800">Total</th>
                </tr>
              </thead>
              <tbody>
                {heatmapRows.map((row) => (
                  <tr key={row.colaborador} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                    <td className="py-2 px-2 text-gray-700 font-medium break-words" style={{ width: '220px' }}>{row.colaborador}</td>
                    {MESES_HH_VIEW.map((mes) => (
                      <td key={mes} className="py-2 px-2 text-right">
                        <div
                          className="px-2 py-1 rounded"
                          style={{
                            background: `linear-gradient(90deg, rgba(220,38,38,0.25) ${heatmapMax.byMonth[mes] ? Math.round(((row[mes] || 0) / heatmapMax.byMonth[mes]) * 100) : 0}%, transparent 0%)`
                          }}
                        >
                          {formatPercent(row[mes] || 0)}
                        </div>
                      </td>
                    ))}
                    <td className="py-2 px-2 text-right font-semibold">
                      <div
                        className="px-2 py-1 rounded"
                        style={{
                          background: `linear-gradient(90deg, rgba(220,38,38,0.25) ${heatmapMax.total ? Math.round(((row.total || 0) / heatmapMax.total) * 100) : 0}%, transparent 0%)`
                        }}
                      >
                        {formatPercent(row.total || 0)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}

function obtenerFechaAdjudicacion(oportunidad) {
  const base =
    normalizarMesAdjudicacion(oportunidad?.proyectos?.fecha_adjudicacion)
    ?? normalizarMesAdjudicacion(oportunidad?.fecha_adjudicacion)

  if (base) return base

  const estado = normalizarEstadoProyecto(oportunidad?.proyectos?.estado)
  if (estado === 'Adjudicado') {
    const year = String(new Date().getFullYear()).slice(-2)
    return `ene-${year}`
  }

  return ''
}

function ordenarMesAdjudicacion(a, b) {
  const [mA, yA] = String(a).split('-')
  const [mB, yB] = String(b).split('-')
  const iA = MESES_ORDEN.indexOf((mA || '').toLowerCase())
  const iB = MESES_ORDEN.indexOf((mB || '').toLowerCase())
  const yearA = parseInt(yA, 10)
  const yearB = parseInt(yB, 10)
  if (Number.isFinite(yearA) && Number.isFinite(yearB) && yearA !== yearB) return yearA - yearB
  if (iA !== iB) return iA - iB
  return String(a).localeCompare(String(b))
}








