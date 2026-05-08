import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import ResizableTh from './ResizableTh'
import FilterableTh from './FilterableTh'

const MESES_NOMBRES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_ABREV   = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MESES_CORTOS  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const AÑOS_2D = [24, 25, 26, 27, 28]
const MES_OPTIONS = AÑOS_2D.flatMap(y => MESES_ABREV.map(m => `${m}-${y}`))

function mesToNum(mes) {
  if (!mes) return 0
  const [abrev, año] = mes.split('-')
  const añoNum = parseInt(año || 0)
  const añoFull = añoNum < 100 ? añoNum + 2000 : añoNum
  return añoFull * 100 + (MESES_ABREV.indexOf((abrev || '').toLowerCase()) + 1)
}

function normalize(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function buildTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

const ABREV_MES = {
  ene: 'enero', feb: 'febrero', mar: 'marzo', abr: 'abril',
  may: 'mayo',  jun: 'junio',  jul: 'julio', ago: 'agosto',
  sep: 'septiembre', oct: 'octubre', nov: 'noviembre', dic: 'diciembre',
}

// Normaliza "ene-26" → "enero-2026", "enero-2026" → "enero-2026", serial → "enero-2026"
function normalizarMesImport(raw) {
  if (raw === null || raw === undefined) return ''
  const str = raw.toString().trim().toLowerCase()
  if (!str) return ''

  // Serial numérico de Excel (ej: 46023)
  const serial = parseFloat(str)
  if (!isNaN(serial) && serial > 1000) {
    const fecha = new Date((serial - 25569) * 86400000)
    return `${MESES_NOMBRES[fecha.getUTCMonth()]}-${fecha.getUTCFullYear()}`
  }

  // Formato "ene-26" o "ene-2026"
  const match = str.match(/^([a-záéíóúü]+)-(\d{2,4})$/)
  if (match) {
    const [, parte, año] = match
    const nombreCompleto = ABREV_MES[parte] || MESES_NOMBRES.find(m => m.startsWith(parte)) || parte
    const añoCompleto = año.length === 2 ? `20${año}` : año
    return `${nombreCompleto}-${añoCompleto}`
  }

  return str
}

function mesActual() {
  const now = new Date()
  return `${MESES_ABREV[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`
}

export default function VistaHorasProyectadas() {
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [colaboradoresSet, setColaboradoresSet] = useState(new Set())
  const [proyectosLista, setProyectosLista] = useState([])
  const [proyectosLinea, setProyectosLinea] = useState({})         // normalize(nombre) → ceco
  const [colaboradoresCosto, setColaboradoresCosto] = useState({}) // normalize(nombre) → { mes → costo }
  const [colaboradoresRut, setColaboradoresRut] = useState({})     // normalize(nombre) → rut
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState(null)
  const [ordenDir, setOrdenDir] = useState('asc')
  const [añoValidator, setAñoValidator] = useState(new Date().getFullYear())
  const [progreso, setProgreso] = useState(null) // null = inactivo, 0-100 = importando, 'ok' = completado
  const cancelarRef = useRef(false)
  const [modalAgregar, setModalAgregar] = useState(false)
  const [formAgregar, setFormAgregar] = useState({ colaborador: '', proyecto_id: '', mes: '', horas: '' })
  const [paginaMain, setPaginaMain] = useState(0)
  const [paginaValidator, setPaginaValidator] = useState(0)
  const [paginaCosto, setPaginaCosto] = useState(0)
  const [paginaLinea, setPaginaLinea] = useState(0)
  const FILAS_POR_PAGINA = 10
  const [busquedaValidator, setBusquedaValidator] = useState('')
  const [filtrosValidator, setFiltrosValidator] = useState({})
  const [dropdownFiltroValidator, setDropdownFiltroValidator] = useState(null)
  const [busquedaCostoPivot, setBusquedaCostoPivot] = useState('')
  const [filtrosCostoPivot, setFiltrosCostoPivot] = useState({})
  const [dropdownFiltroCostoPivot, setDropdownFiltroCostoPivot] = useState(null)
  const [busquedaLineaPivot, setBusquedaLineaPivot] = useState('')
  const [filtrosLineaPivot, setFiltrosLineaPivot] = useState({})
  const [dropdownFiltroLineaPivot, setDropdownFiltroLineaPivot] = useState(null)

  useEffect(() => {
    cargarDatos()
    cargarValidaciones()
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  useEffect(() => {
    if (!dropdownFiltroValidator) return
    function cerrar() { setDropdownFiltroValidator(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltroValidator])

  useEffect(() => {
    if (!dropdownFiltroCostoPivot) return
    function cerrar() { setDropdownFiltroCostoPivot(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltroCostoPivot])

  useEffect(() => {
    if (!dropdownFiltroLineaPivot) return
    function cerrar() { setDropdownFiltroLineaPivot(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltroLineaPivot])

  useEffect(() => { setPaginaMain(0) }, [busqueda, filtros, ordenCol, ordenDir])
  useEffect(() => { setPaginaValidator(0) }, [busquedaValidator, filtrosValidator])
  useEffect(() => { setPaginaCosto(0) }, [busquedaCostoPivot, filtrosCostoPivot])
  useEffect(() => { setPaginaLinea(0) }, [busquedaLineaPivot, filtrosLineaPivot])

  async function cargarDatos() {
    setLoading(true)
    const PAGE = 1000
    let todas = [], from = 0, error = null
    while (true) {
      const { data, error: err } = await supabase
        .from('horas_proyectadas')
        .select('*')
        .order('colaborador', { ascending: true })
        .range(from, from + PAGE - 1)
      if (err) { error = err; break }
      todas = [...todas, ...(data || [])]
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    if (error) toast.error('Error al cargar: ' + error.message)
    else setFilas(todas)
    setLoading(false)
  }

  async function cargarValidaciones() {
    const [{ data: cols }, { data: proyectos }] = await Promise.all([
      supabase.from('colaboradores').select('colaborador, rut'),
      supabase.from('proyectos').select('id, nombre, ceco').order('nombre'),
    ])
    setColaboradoresSet(new Set((cols || []).map(c => normalize(c.colaborador))))
    const rutMap = {}
    for (const c of (cols || [])) rutMap[normalize(c.colaborador)] = c.rut || ''
    setColaboradoresRut(rutMap)
    setProyectosLista(proyectos || [])
    const lineasMap = {}
    for (const p of (proyectos || [])) lineasMap[normalize(p.nombre)] = p.ceco || ''
    setProyectosLinea(lineasMap)

    // Cargar costos mensuales: { normalize(colaborador) → { mes → costo_mes } }
    const PAGE = 1000
    let costos = [], from = 0
    while (true) {
      const { data } = await supabase.from('colaboradores_costos').select('colaborador, mes, costo_mes').range(from, from + PAGE - 1)
      if (!data?.length) break
      costos = [...costos, ...data]
      if (data.length < PAGE) break
      from += PAGE
    }
    const costoMap = {}
    for (const c of costos) {
      const key = normalize(c.colaborador)
      if (!costoMap[key]) costoMap[key] = {}
      costoMap[key][c.mes] = parseFloat(c.costo_mes) || 0
    }
    setColaboradoresCosto(costoMap)
  }

  async function guardarCelda(id, col, valor) {
    const val = col === 'horas' ? (parseFloat(valor) || 0) : valor
    const updateObj = { [col]: val }
    if (col === 'proyecto_id') {
      updateObj.proyecto = proyectosLista.find(p => p.id === val)?.nombre || ''
    }
    const { error } = await supabase.from('horas_proyectadas').update(updateObj).eq('id', id)
    if (error) { toast.error('Error al guardar: ' + error.message); return }
    toast.success('Guardado')
    setFilas(prev => prev.map(f => f.id === id ? { ...f, ...updateObj } : f))
  }

  async function confirmarAgregar() {
    const colaborador = formAgregar.colaborador.trim()
    const proyecto_id = formAgregar.proyecto_id
    const mes         = formAgregar.mes
    const horas       = parseFloat(formAgregar.horas) || 0
    if (!colaborador) { toast.error('El colaborador es obligatorio'); return }
    if (!proyecto_id) { toast.error('El proyecto es obligatorio'); return }
    if (!mes)         { toast.error('El mes es obligatorio'); return }
    const proyecto = proyectosLista.find(p => p.id === proyecto_id)?.nombre || ''
    const { data, error } = await supabase
      .from('horas_proyectadas')
      .insert({ colaborador, proyecto_id, proyecto, mes, horas })
      .select()
      .single()
    if (error) { toast.error('Error al agregar: ' + error.message); return }
    setFilas(prev => [...prev, data])
    setModalAgregar(false)
    setFormAgregar({ colaborador: '', proyecto_id: '', mes: '', horas: '' })
    toast.success('Registro agregado')
  }

  async function eliminarFila(id) {
    if (!confirm('¿Eliminar esta fila?')) return
    const { error } = await supabase.from('horas_proyectadas').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar: ' + error.message); return }
    setFilas(prev => prev.filter(f => f.id !== id))
    toast.success('Fila eliminada')
  }

  function toggleOrden(col) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
  }

  function setFiltro(col, valor) {
    setFiltros(prev => ({ ...prev, [col]: valor }))
    setPaginaMain(0)
  }

  function setFiltroValidator(col, valor) { setFiltrosValidator(prev => ({ ...prev, [col]: valor })) }
  function setFiltroCostoPivot(col, valor) { setFiltrosCostoPivot(prev => ({ ...prev, [col]: valor })) }
  function setFiltroLineaPivot(col, valor) { setFiltrosLineaPivot(prev => ({ ...prev, [col]: valor })) }

  function coincideFiltros(f) {
    const q = busqueda.toLowerCase()
    const linea = proyectosLinea[normalize(f.proyecto)] || ''
    const rut = colaboradoresRut[normalize(f.colaborador)] || ''
    const costo = (parseFloat(f.horas) || 0) * (colaboradoresCosto[normalize(f.colaborador)]?.[f.mes] || 0)
    const costoStr = costo === 0 ? '' : Math.round(costo).toLocaleString('es-CL')
    const matchBusqueda = !q || [f.colaborador, f.proyecto, f.mes, linea, rut].some(v => (v || '').toLowerCase().includes(q))
    const matchColaborador = !filtros.colaborador?.length || filtros.colaborador.includes(f.colaborador)
    const matchProyecto    = !filtros.proyecto?.length    || filtros.proyecto.includes(f.proyecto)
    const matchMes         = !filtros.mes?.length         || filtros.mes.includes(f.mes)
    const matchLinea       = !filtros.linea?.length       || filtros.linea.includes(linea)
    const matchRut         = !filtros.rut?.length         || filtros.rut.includes(rut)
    const matchHoras       = !filtros.horas?.length       || filtros.horas.includes(String(f.horas || ''))
    const matchCosto       = !filtros.costo?.length       || filtros.costo.includes(costoStr)
    const enCol  = colaboradoresSet.has(normalize(f.colaborador))
    const enProy = proyectosSet.has(normalize(f.proyecto))
    const matchEnCol  = !filtros.enColaboradores?.length  || (filtros.enColaboradores.includes('Sí') && enCol)  || (filtros.enColaboradores.includes('No') && !enCol)
    const matchEnProy = !filtros.enProyectos?.length      || (filtros.enProyectos.includes('Sí') && enProy) || (filtros.enProyectos.includes('No') && !enProy)
    return matchBusqueda && matchColaborador && matchProyecto && matchMes && matchLinea && matchRut && matchHoras && matchCosto && matchEnCol && matchEnProy
  }

  function opcionesPorColumna(obtenerValor, esmes = false) {
    const base = filas.map(obtenerValor).filter(Boolean)
    const uniq = [...new Set(base)]
    return esmes
      ? uniq.sort((a, b) => mesToNum(a) - mesToNum(b))
      : uniq.sort((a, b) => String(a).localeCompare(String(b), 'es'))
  }

  const proyectosSet = new Set(proyectosLista.map(p => normalize(p.nombre)))

  const opcionesColaborador = opcionesPorColumna(f => f.colaborador)
  const opcionesProyecto    = opcionesPorColumna(f => f.proyecto)
  const opcionesMes         = opcionesPorColumna(f => f.mes, true)
  const opcionesLinea       = [...new Set(filas.map(f => proyectosLinea[normalize(f.proyecto)] || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const opcionesRut         = [...new Set(filas.map(f => colaboradoresRut[normalize(f.colaborador)] || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const opcionesHoras       = [...new Set(filas.map(f => String(f.horas || '')).filter(Boolean))].sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0))
  const opcionesCosto       = [...new Set(filas.map(f => {
    const c = (parseFloat(f.horas) || 0) * (colaboradoresCosto[normalize(f.colaborador)]?.[f.mes] || 0)
    return c === 0 ? '' : Math.round(c).toLocaleString('es-CL')
  }).filter(Boolean))].sort((a, b) => (parseInt(a.replace(/\./g, '')) || 0) - (parseInt(b.replace(/\./g, '')) || 0))

  const filasFiltradas = filas
    .filter(coincideFiltros)
    .sort((a, b) => {
      if (!ordenCol) {
        const colCmp = (a.colaborador || '').localeCompare(b.colaborador || '', 'es')
        if (colCmp !== 0) return colCmp
        const mesCmp = mesToNum(a.mes) - mesToNum(b.mes)
        if (mesCmp !== 0) return mesCmp
        return (a.proyecto || '').localeCompare(b.proyecto || '', 'es')
      }
      let vA, vB
      switch (ordenCol) {
        case 'colaborador': vA = a.colaborador || ''; vB = b.colaborador || ''; break
        case 'proyecto':    vA = a.proyecto    || ''; vB = b.proyecto    || ''; break
        case 'linea':       vA = proyectosLinea[normalize(a.proyecto)] || ''; vB = proyectosLinea[normalize(b.proyecto)] || ''; break
        case 'mes':         return ordenDir === 'asc' ? mesToNum(a.mes) - mesToNum(b.mes) : mesToNum(b.mes) - mesToNum(a.mes)
        case 'horas':       vA = parseFloat(a.horas) || 0; vB = parseFloat(b.horas) || 0; break
        default: return 0
      }
      if (typeof vA === 'string') return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
      return ordenDir === 'asc' ? vA - vB : vB - vA
    })

  const totalHoras = filasFiltradas.reduce((sum, f) => sum + (parseFloat(f.horas) || 0), 0)
  const totalCosto = filasFiltradas.reduce((sum, f) => {
    const h = parseFloat(f.horas) || 0
    const c = colaboradoresCosto[normalize(f.colaborador)]?.[f.mes] || 0
    return sum + h * c
  }, 0)

  // ── VALIDADOR: pivot colaborador × mes ──
  const añosDisponibles = [...new Set(
    filas.map(f => {
      const a = parseInt((f.mes || '').split('-')[1] || '0')
      return a < 100 ? a + 2000 : a
    }).filter(Boolean)
  )].sort()

  // pivot: { colaborador -> { mesAbrev -> horas } }
  const validatorPivot = {}
  for (const f of filas) {
    const [abrev, añoCorto] = (f.mes || '').split('-')
    const añoFull = parseInt(añoCorto || '0') + (parseInt(añoCorto || '0') < 100 ? 2000 : 0)
    if (añoFull !== añoValidator) continue
    const mesKey = (abrev || '').toLowerCase()
    if (!MESES_ABREV.includes(mesKey)) continue
    if (!validatorPivot[f.colaborador]) validatorPivot[f.colaborador] = {}
    validatorPivot[f.colaborador][mesKey] =
      (validatorPivot[f.colaborador][mesKey] || 0) + (parseFloat(f.horas) || 0)
  }
  const validatorColabs = Object.keys(validatorPivot).sort((a, b) => a.localeCompare(b, 'es'))

  // totales por mes (horas)
  const totalPorMes = {}
  for (const mes of MESES_ABREV) {
    totalPorMes[mes] = validatorColabs.reduce((sum, c) => sum + (validatorPivot[c]?.[mes] || 0), 0)
  }
  const totalValidador = MESES_ABREV.reduce((sum, m) => sum + totalPorMes[m], 0)

  // pivot costo: { colaborador -> { mesAbrev -> costo } }
  const costoPivot = {}
  for (const f of filas) {
    const [abrev, añoCorto] = (f.mes || '').split('-')
    const añoFull = parseInt(añoCorto || '0') + (parseInt(añoCorto || '0') < 100 ? 2000 : 0)
    if (añoFull !== añoValidator) continue
    const mesKey = (abrev || '').toLowerCase()
    if (!MESES_ABREV.includes(mesKey)) continue
    const costo = (parseFloat(f.horas) || 0) * (colaboradoresCosto[normalize(f.colaborador)]?.[f.mes] || 0)
    if (!costoPivot[f.colaborador]) costoPivot[f.colaborador] = {}
    costoPivot[f.colaborador][mesKey] = (costoPivot[f.colaborador][mesKey] || 0) + costo
  }
  const costoColabs = Object.keys(costoPivot).sort((a, b) => a.localeCompare(b, 'es'))
  const costoPorMes = {}
  for (const mes of MESES_ABREV) {
    costoPorMes[mes] = costoColabs.reduce((sum, c) => sum + (costoPivot[c]?.[mes] || 0), 0)
  }
  const totalCostoPivot = MESES_ABREV.reduce((sum, m) => sum + costoPorMes[m], 0)

  // pivot costo por línea: { linea -> { mesAbrev -> costo } }
  const costoLineaPivot = {}
  for (const f of filas) {
    const [abrev, añoCorto] = (f.mes || '').split('-')
    const añoFull = parseInt(añoCorto || '0') + (parseInt(añoCorto || '0') < 100 ? 2000 : 0)
    if (añoFull !== añoValidator) continue
    const mesKey = (abrev || '').toLowerCase()
    if (!MESES_ABREV.includes(mesKey)) continue
    const linea = proyectosLinea[normalize(f.proyecto)] || ''
    if (!linea) continue
    const costo = (parseFloat(f.horas) || 0) * (colaboradoresCosto[normalize(f.colaborador)]?.[f.mes] || 0)
    if (!costoLineaPivot[linea]) costoLineaPivot[linea] = {}
    costoLineaPivot[linea][mesKey] = (costoLineaPivot[linea][mesKey] || 0) + costo
  }
  const costoLineas = Object.keys(costoLineaPivot).sort((a, b) => a.localeCompare(b, 'es'))
  const costoPorMesLinea = {}
  for (const mes of MESES_ABREV) {
    costoPorMesLinea[mes] = costoLineas.reduce((sum, l) => sum + (costoLineaPivot[l]?.[mes] || 0), 0)
  }
  const totalCostoLinea = MESES_ABREV.reduce((sum, m) => sum + costoPorMesLinea[m], 0)

  const opcionesColaboradorValidator = [...validatorColabs]
  const opcionesRutValidator = [...new Set(validatorColabs.map(c => colaboradoresRut[normalize(c)] || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const opcionesColaboradorCosto = [...costoColabs]
  const opcionesRutCosto = [...new Set(costoColabs.map(c => colaboradoresRut[normalize(c)] || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const opcionesLineaPivot = [...costoLineas]

  const validatorColabsFiltrados = validatorColabs.filter(col => {
    const q = busquedaValidator.toLowerCase()
    const rut = colaboradoresRut[normalize(col)] || ''
    const matchBusqueda = !q || [col, rut].some(v => v.toLowerCase().includes(q))
    const matchCol = !filtrosValidator.colaborador?.length || filtrosValidator.colaborador.includes(col)
    const matchRut = !filtrosValidator.rut?.length || filtrosValidator.rut.includes(rut)
    return matchBusqueda && matchCol && matchRut
  })
  const totalPorMesFiltrado = {}
  for (const mes of MESES_ABREV) {
    totalPorMesFiltrado[mes] = validatorColabsFiltrados.reduce((sum, c) => sum + (validatorPivot[c]?.[mes] || 0), 0)
  }
  const totalValidadorFiltrado = MESES_ABREV.reduce((sum, m) => sum + totalPorMesFiltrado[m], 0)

  const costoColabsFiltrados = costoColabs.filter(col => {
    const q = busquedaCostoPivot.toLowerCase()
    const rut = colaboradoresRut[normalize(col)] || ''
    const matchBusqueda = !q || [col, rut].some(v => v.toLowerCase().includes(q))
    const matchCol = !filtrosCostoPivot.colaborador?.length || filtrosCostoPivot.colaborador.includes(col)
    const matchRut = !filtrosCostoPivot.rut?.length || filtrosCostoPivot.rut.includes(rut)
    return matchBusqueda && matchCol && matchRut
  })
  const costoPorMesFiltrado = {}
  for (const mes of MESES_ABREV) {
    costoPorMesFiltrado[mes] = costoColabsFiltrados.reduce((sum, c) => sum + (costoPivot[c]?.[mes] || 0), 0)
  }
  const totalCostoPivotFiltrado = MESES_ABREV.reduce((sum, m) => sum + costoPorMesFiltrado[m], 0)

  const costoLineasFiltradas = costoLineas.filter(linea => {
    const q = busquedaLineaPivot.toLowerCase()
    const matchBusqueda = !q || linea.toLowerCase().includes(q)
    const matchLinea = !filtrosLineaPivot.linea?.length || filtrosLineaPivot.linea.includes(linea)
    return matchBusqueda && matchLinea
  })
  const costoPorMesLineaFiltrado = {}
  for (const mes of MESES_ABREV) {
    costoPorMesLineaFiltrado[mes] = costoLineasFiltradas.reduce((sum, l) => sum + (costoLineaPivot[l]?.[mes] || 0), 0)
  }
  const totalCostoLineaFiltrado = MESES_ABREV.reduce((sum, m) => sum + costoPorMesLineaFiltrado[m], 0)

  function exportarCostoPivot() {
    const rows = costoColabs.map(col => {
      const row = { COLABORADOR: col, RUT: colaboradoresRut[normalize(col)] || '' }
      let total = 0
      MESES_ABREV.forEach((abrev, i) => {
        const c = costoPivot[col]?.[abrev] || 0
        row[MESES_NOMBRES[i].toUpperCase()] = Math.round(c)
        total += c
      })
      row['TOTAL'] = Math.round(total)
      return row
    })
    const rowTotal = { COLABORADOR: 'TOTAL', RUT: '' }
    MESES_ABREV.forEach((abrev, i) => { rowTotal[MESES_NOMBRES[i].toUpperCase()] = Math.round(costoPorMes[abrev]) })
    rowTotal['TOTAL'] = Math.round(totalCostoPivot)
    rows.push(rowTotal)
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `CostoPorColaborador_${añoValidator}`)
    XLSX.writeFile(wb, `costo_colaborador_${añoValidator}_${buildTimestamp()}.xlsx`)
  }

  function exportarCostoLinea() {
    const rows = costoLineas.map(linea => {
      const row = { LINEA: linea }
      let total = 0
      MESES_ABREV.forEach((abrev, i) => {
        const c = costoLineaPivot[linea]?.[abrev] || 0
        row[MESES_NOMBRES[i].toUpperCase()] = Math.round(c)
        total += c
      })
      row['TOTAL'] = Math.round(total)
      return row
    })
    const rowTotal = { LINEA: 'TOTAL' }
    MESES_ABREV.forEach((abrev, i) => { rowTotal[MESES_NOMBRES[i].toUpperCase()] = Math.round(costoPorMesLinea[abrev]) })
    rowTotal['TOTAL'] = Math.round(totalCostoLinea)
    rows.push(rowTotal)
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `CostoPorLinea_${añoValidator}`)
    XLSX.writeFile(wb, `costo_linea_${añoValidator}_${buildTimestamp()}.xlsx`)
  }

  function exportarValidador() {
    const rows = validatorColabs.map(col => {
      const row = { COLABORADOR: col, RUT: colaboradoresRut[normalize(col)] || '' }
      let total = 0
      MESES_ABREV.forEach((abrev, i) => {
        const h = validatorPivot[col]?.[abrev] || 0
        row[MESES_NOMBRES[i].toUpperCase()] = h
        total += h
      })
      row['TOTAL'] = total
      return row
    })
    const rowTotal = { COLABORADOR: 'TOTAL', RUT: '' }
    MESES_ABREV.forEach((abrev, i) => { rowTotal[MESES_NOMBRES[i].toUpperCase()] = totalPorMes[abrev] })
    rowTotal['TOTAL'] = totalValidador
    rows.push(rowTotal)

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Resumen_${añoValidator}`)
    XLSX.writeFile(wb, `resumen_horas_${añoValidator}_${buildTimestamp()}.xlsx`)
  }

  // ── IMPORTAR EXCEL ──
  async function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return

    if (filas.length > 0) {
      const ok = confirm(`La tabla tiene ${filas.length} filas existentes. Al importar se BORRARÁN todas y se reemplazarán por las del Excel.\n\n¿Continuar?`)
      if (!ok) { e.target.value = ''; return }
    }

    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws)

        // Borrar todo lo existente antes de insertar
        const { error: errorBorrar } = await supabase
          .from('horas_proyectadas')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')
        if (errorBorrar) {
          toast.error('Error al limpiar tabla: ' + errorBorrar.message)
          return
        }

        // Preparar filas válidas
        const invalidos = []
        const sinProyecto = []
        const filasBatch = []
        const nombreToId = {}
        for (const p of proyectosLista) nombreToId[normalize(p.nombre)] = p.id

        for (const row of data) {
          const colaborador = (row.COLABORADOR || row.colaborador || '').toString().trim()
          const proyecto    = (row.PROYECTO    || row.proyecto    || '').toString().trim()
          const horas       = parseFloat(row.HORAS || row.horas) || 0

          // Normalizar MES: puede venir como string "enero-2026" o como serial numérico de Excel
          const mesRaw = row.MES ?? row.mes ?? ''
          let mes = mesRaw.toString().trim()
          const serial = parseFloat(mes)
          if (!isNaN(serial) && serial > 1000) {
            // Convertir serial de Excel a "mes-año"
            const fecha = new Date((serial - 25569) * 86400000)
            mes = `${MESES_NOMBRES[fecha.getUTCMonth()]}-${fecha.getUTCFullYear()}`
          }

          if (!colaborador || !proyecto || !mes) continue
          if (!MES_OPTIONS.includes(mes)) { invalidos.push(mes); continue }
          const proyecto_id = nombreToId[normalize(proyecto)]
          if (!proyecto_id) { sinProyecto.push(proyecto); continue }
          filasBatch.push({ colaborador, proyecto_id, proyecto, mes, horas })
        }

        if (invalidos.length > 0) {
          toast.warning(`Meses inválidos (usar formato "ene-26"): ${[...new Set(invalidos)].slice(0, 3).join(', ')}`, { autoClose: 6000 })
        }
        if (sinProyecto.length > 0) {
          toast.warning(`Proyectos no encontrados en la tabla: ${[...new Set(sinProyecto)].slice(0, 3).join(', ')}`, { autoClose: 8000 })
        }

        if (filasBatch.length === 0) {
          toast.error('No hay filas válidas para importar')
          setProgreso(null)
          return
        }

        // Insertar en chunks de 500 para no superar límites de request
        cancelarRef.current = false
        setProgreso(0)
        const CHUNK = 500
        let insertados = 0, errores = 0

        for (let i = 0; i < filasBatch.length; i += CHUNK) {
          if (cancelarRef.current) {
            toast.warning(`Importación cancelada. Se insertaron ${insertados} filas antes de cancelar.`)
            setProgreso(null)
            cargarDatos()
            return
          }
          const chunk = filasBatch.slice(i, i + CHUNK)
          const { error } = await supabase.from('horas_proyectadas').insert(chunk)
          if (error) { errores += chunk.length; console.error(error) }
          else insertados += chunk.length
          setProgreso(Math.round(Math.min((i + CHUNK) / filasBatch.length, 1) * 100))
        }

        setProgreso('ok')
        setTimeout(() => setProgreso(null), 3000)
        toast.success(`Importación completada: ${insertados} filas creadas${errores > 0 ? `, ${errores} errores` : ''}`)
        cargarDatos()
      } catch (err) {
        toast.error('Error: ' + err.message)
        setProgreso(null)
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  // ── EXPORTAR EXCEL ──
  // Columnas calculadas (LINEA, COSTO, EN_COLABORADORES, EN_PROYECTOS) se incluyen como referencia,
  // pero al importar se IGNORAN — siempre se recalculan desde los datos maestros.
  function exportarExcel() {
    const filasOrdenadas = [...filasFiltradas].sort((a, b) => {
      const colA = (a.colaborador || '').localeCompare(b.colaborador || '', 'es')
      if (colA !== 0) return colA
      const mesA = mesToNum(a.mes), mesB = mesToNum(b.mes)
      if (mesA !== mesB) return mesA - mesB
      return (a.proyecto || '').localeCompare(b.proyecto || '', 'es')
    })
    const rows = filasOrdenadas.map(f => {
      const enCol  = colaboradoresSet.has(normalize(f.colaborador)) ? 'Sí' : 'No'
      const enProy = proyectosSet.has(normalize(f.proyecto))        ? 'Sí' : 'No'
      return {
        COLABORADOR:      f.colaborador || '',
        RUT:              colaboradoresRut[normalize(f.colaborador)] || '',
        PROYECTO:         f.proyecto    || '',
        LINEA:            proyectosLinea[normalize(f.proyecto)] || '',
        MES:              f.mes         || '',
        HORAS:            parseFloat(f.horas) || 0,
        COSTO:            Math.round((parseFloat(f.horas) || 0) * (colaboradoresCosto[normalize(f.colaborador)]?.[f.mes] || 0)),
        EN_COLABORADORES: enCol,
        EN_PROYECTOS:     enProy,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)

    // Forzar columna MES (índice 4: COLABORADOR, RUT, PROYECTO, LINEA, MES) como texto
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let R = range.s.r; R <= range.e.r; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: 4 })
      if (ws[addr]) { ws[addr].t = 's'; ws[addr].z = '@' }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'HorasProyectadas')
    XLSX.writeFile(wb, `horas_proyectadas_${buildTimestamp()}.xlsx`)
  }

  return (
    <div className="flex flex-col gap-0">

      {/* ── HEADER PÁGINA ── */}
      <div className="flex-shrink-0 pb-2">
        <div className="flex justify-between items-center mb-2 flex-wrap gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Horas Proyectadas</h2>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => { setFormAgregar({ colaborador: '', proyecto_id: '', mes: mesActual(), horas: '' }); setModalAgregar(true) }}
              className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: '#FF5100' }}
            >
              + Agregar registro
            </button>
            <input
              type="text"
              placeholder="Buscar..."
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPaginaMain(0) }}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={exportarExcel}
              disabled={filasFiltradas.length === 0}
              className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#6366F1' }}
            >
              Exportar Excel
            </button>
            <label
              className="px-4 py-2 rounded-lg text-white font-medium transition-all cursor-pointer hover:opacity-90"
              style={{ backgroundColor: '#10B981' }}
            >
              Importar Excel
              <input type="file" accept=".xlsx,.xls" onChange={importarExcel} className="hidden" />
            </label>
            <button
              onClick={() => { cargarDatos(); cargarValidaciones() }}
              className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-all"
            >
              Recargar
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Formato importación: columnas <strong>COLABORADOR</strong>, <strong>PROYECTO</strong>, <strong>MES</strong> (ej: <em>ene-26</em>), <strong>HORAS</strong>
        </p>

        {/* Barra de progreso importación */}
        {progreso !== null && (
          <div className="mt-2">
            {progreso === 'ok' ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-green-200">
                  <div className="h-2 rounded-full bg-green-500 w-full transition-all" />
                </div>
                <span className="text-xs font-semibold text-green-600 whitespace-nowrap">Importación completada ✓</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-orange-500 transition-all duration-200"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-orange-600 whitespace-nowrap w-10 text-right">{progreso}%</span>
                <button
                  onClick={() => { cancelarRef.current = true }}
                  className="text-xs px-2 py-0.5 rounded border border-red-300 text-red-500 hover:bg-red-50 whitespace-nowrap transition-all"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TABLA PRINCIPAL ── */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        {loading ? (
          <div className="text-center py-12"><p className="text-gray-500">Cargando...</p></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
                <ResizableTh className="py-3 px-4 text-gray-500 font-semibold bg-[#FFF5F0] text-center" style={{ width: '48px' }}>#</ResizableTh>
                <FilterableTh
                  col="colaborador" label="Colaborador" align="left" style={{ width: '180px' }}
                  opciones={opcionesColaborador} filtro={filtros.colaborador || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'colaborador'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'colaborador'} ordenDir={ordenDir} onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="rut" label="RUT" align="left" style={{ width: '110px' }}
                  opciones={opcionesRut} filtro={filtros.rut || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'rut'} onToggleDropdown={setDropdownFiltro}
                />
                <FilterableTh
                  col="proyecto" label="Proyecto" align="left"
                  opciones={opcionesProyecto} filtro={filtros.proyecto || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'proyecto'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'proyecto'} ordenDir={ordenDir} onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="linea" label="Línea" align="left" style={{ width: '130px' }}
                  opciones={opcionesLinea} filtro={filtros.linea || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'linea'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'linea'} ordenDir={ordenDir} onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="mes" label="Mes" align="left" style={{ width: '140px' }}
                  opciones={opcionesMes} filtro={filtros.mes || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'mes'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'mes'} ordenDir={ordenDir} onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="horas" label="Horas" align="right" style={{ width: '90px' }}
                  opciones={opcionesHoras} filtro={filtros.horas || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'horas'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'horas'} ordenDir={ordenDir} onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="costo" label="Costo" align="right" style={{ width: '120px' }}
                  opciones={opcionesCosto} filtro={filtros.costo || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'costo'} onToggleDropdown={setDropdownFiltro}
                />
                <FilterableTh
                  col="enColaboradores" label="En Colaboradores" align="center" style={{ width: '140px' }}
                  opciones={['Sí', 'No']} filtro={filtros.enColaboradores || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'enColaboradores'} onToggleDropdown={setDropdownFiltro}
                />
                <FilterableTh
                  col="enProyectos" label="En Proyectos" align="center" style={{ width: '120px' }}
                  opciones={['Sí', 'No']} filtro={filtros.enProyectos || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'enProyectos'} onToggleDropdown={setDropdownFiltro}
                />
                <ResizableTh className="bg-[#FFF5F0]" style={{ width: '42px' }} />
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400">
                    {filas.length === 0 ? 'No hay registros. Usa "+ Agregar registro" o importa un Excel.' : 'Sin resultados para los filtros aplicados.'}
                  </td>
                </tr>
              )}
              {filasFiltradas.slice(paginaMain * FILAS_POR_PAGINA, (paginaMain + 1) * FILAS_POR_PAGINA).map((f, idx) => {
                const enCol  = colaboradoresSet.has(normalize(f.colaborador))
                const enProy = proyectosSet.has(normalize(f.proyecto))
                const mesOpts = MES_OPTIONS.includes(f.mes) ? MES_OPTIONS : [f.mes, ...MES_OPTIONS]
                const linea = proyectosLinea[normalize(f.proyecto)] || ''
                const costo = (parseFloat(f.horas) || 0) * (colaboradoresCosto[normalize(f.colaborador)]?.[f.mes] || 0)
                const numFila = paginaMain * FILAS_POR_PAGINA + idx + 1
                return (
                  <tr key={f.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                    <td className="py-2 px-2 text-gray-400 text-sm text-center">{numFila}</td>
                    <td className="py-2 px-2">
                      <input type="text" defaultValue={f.colaborador} key={f.id + '_col'}
                        onBlur={e => guardarCelda(f.id, 'colaborador', e.target.value)}
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-sm"
                        placeholder="Nombre colaborador" />
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-500 tabular-nums whitespace-nowrap">
                      {colaboradoresRut[normalize(f.colaborador)] || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2 px-2">
                      <select value={f.proyecto_id || ''} key={f.id + '_proy'}
                        onChange={e => guardarCelda(f.id, 'proyecto_id', e.target.value)}
                        className="w-full border border-gray-200 bg-transparent focus:bg-white focus:border-blue-300 rounded px-1 py-0.5 text-sm">
                        {proyectosLista.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-2 text-sm text-gray-600 truncate" title={linea}>{linea || <span className="text-gray-300">—</span>}</td>
                    <td className="py-2 px-2">
                      <select defaultValue={f.mes || ''} key={f.id + '_mes'}
                        onChange={e => guardarCelda(f.id, 'mes', e.target.value)}
                        className="w-full border border-gray-200 bg-transparent focus:bg-white focus:border-blue-300 rounded px-1 py-0.5 text-sm">
                        {mesOpts.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input type="text" defaultValue={f.horas} key={f.id + '_horas'}
                        onBlur={e => guardarCelda(f.id, 'horas', e.target.value)}
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-sm text-right"
                        placeholder="0" />
                    </td>
                    <td className="py-2 px-4 text-right text-sm tabular-nums text-gray-700">
                      {costo === 0 ? <span className="text-gray-300">—</span> : Math.round(costo).toLocaleString('es-CL')}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${enCol ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}>{enCol ? 'Sí' : 'No'}</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${enProy ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}>{enProy ? 'Sí' : 'No'}</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button onClick={() => eliminarFila(f.id)} className="text-gray-300 hover:text-red-500 transition-all" title="Eliminar fila">
                        <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l1 14h10l1-14" /><path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filasFiltradas.length > 0 && (
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td colSpan={6} className="py-3 px-4 text-gray-800">TOTAL ({filasFiltradas.length})</td>
                  <td className="py-3 px-4 text-right text-gray-800">{totalHoras.toLocaleString('es-CL', { maximumFractionDigits: 1 })}</td>
                  <td className="py-3 px-4 text-right text-gray-800">{Math.round(totalCosto).toLocaleString('es-CL')}</td>
                  <td colSpan={3} />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {!loading && filasFiltradas.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
          <span>{paginaMain * FILAS_POR_PAGINA + 1}–{Math.min((paginaMain + 1) * FILAS_POR_PAGINA, filasFiltradas.length)} de {filasFiltradas.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPaginaMain(p => Math.max(0, p - 1))} disabled={paginaMain === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPaginaMain(p => p + 1)} disabled={(paginaMain + 1) * FILAS_POR_PAGINA >= filasFiltradas.length}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

      {/* ── HEADER VALIDADOR (fijo, fuera del scroll) ── */}
      {!loading && (
        <div className="flex-shrink-0 flex justify-between items-center pt-3 pb-1 flex-wrap gap-3">
          <h3 className="text-lg font-bold text-gray-800">Resumen por colaborador</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              value={busquedaValidator}
              onChange={e => setBusquedaValidator(e.target.value)}
              placeholder="Buscar colaborador..."
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
            />
            <label className="text-sm text-gray-600 font-medium">Año:</label>
            <select
              value={añoValidator}
              onChange={e => setAñoValidator(parseInt(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {añosDisponibles.length > 0
                ? añosDisponibles.map(a => <option key={a} value={a}>{a}</option>)
                : <option value={añoValidator}>{añoValidator}</option>
              }
            </select>
            <button
              onClick={exportarValidador}
              disabled={validatorColabs.length === 0}
              className="px-4 py-1.5 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#6366F1' }}
            >
              Exportar Excel
            </button>
          </div>
        </div>
      )}

      {/* ── TABLA VALIDADOR ── */}
      {!loading && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          {validatorColabs.length === 0 ? (
            <p className="text-sm text-gray-400 italic p-4">Sin datos para {añoValidator}.</p>
          ) : (
            <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: '#FFF5F0' }} className="border-b-2 border-gray-300">
                  <FilterableTh
                    col="colaborador" label="Colaborador" align="left" style={{ whiteSpace: 'nowrap' }}
                    opciones={opcionesColaboradorValidator} filtro={filtrosValidator.colaborador || []}
                    onFiltro={setFiltroValidator} dropdownAbierto={dropdownFiltroValidator === 'colaborador'} onToggleDropdown={setDropdownFiltroValidator}
                  />
                  <FilterableTh
                    col="rut" label="RUT" align="left" style={{ whiteSpace: 'nowrap' }}
                    opciones={opcionesRutValidator} filtro={filtrosValidator.rut || []}
                    onFiltro={setFiltroValidator} dropdownAbierto={dropdownFiltroValidator === 'rut'} onToggleDropdown={setDropdownFiltroValidator}
                  />
                  {MESES_CORTOS.map((mc, i) => (
                    <th key={mc} className="py-2 px-3 text-right font-semibold text-gray-800 whitespace-nowrap bg-[#FFF5F0]" title={MESES_NOMBRES[i]}>{mc}</th>
                  ))}
                  <th className="py-2 px-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-orange-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {validatorColabsFiltrados.slice(paginaValidator * FILAS_POR_PAGINA, (paginaValidator + 1) * FILAS_POR_PAGINA).map((col, idx) => {
                  const rowTotal = MESES_ABREV.reduce((sum, m) => sum + (validatorPivot[col]?.[m] || 0), 0)
                  return (
                    <tr key={col} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                      <td className="py-2 px-4 font-medium text-gray-700 whitespace-nowrap">{col || <span className="text-gray-400 italic">(sin nombre)</span>}</td>
                      <td className="py-2 px-4 text-sm text-gray-500 tabular-nums whitespace-nowrap">{colaboradoresRut[normalize(col)] || <span className="text-gray-300">—</span>}</td>
                      {MESES_ABREV.map(mes => {
                        const h = validatorPivot[col]?.[mes] || 0
                        return <td key={mes} className={`py-2 px-3 text-right tabular-nums ${h === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{h === 0 ? '0,00' : h.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      })}
                      <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-50 tabular-nums">{rowTotal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td colSpan={2} className="py-2 px-4 text-gray-800">TOTAL ({validatorColabsFiltrados.length})</td>
                  {MESES_ABREV.map(mes => (
                    <td key={mes} className="py-2 px-3 text-right tabular-nums text-gray-800">{totalPorMesFiltrado[mes] === 0 ? '0,00' : totalPorMesFiltrado[mes].toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  ))}
                  <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-100 tabular-nums">{totalValidadorFiltrado.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
      {!loading && validatorColabsFiltrados.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
          <span>{paginaValidator * FILAS_POR_PAGINA + 1}–{Math.min((paginaValidator + 1) * FILAS_POR_PAGINA, validatorColabsFiltrados.length)} de {validatorColabsFiltrados.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPaginaValidator(p => Math.max(0, p - 1))} disabled={paginaValidator === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPaginaValidator(p => p + 1)} disabled={(paginaValidator + 1) * FILAS_POR_PAGINA >= validatorColabsFiltrados.length}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

      {/* ── HEADER COSTO PIVOT ── */}
      {!loading && (
        <div className="flex-shrink-0 flex justify-between items-center pt-3 pb-1 flex-wrap gap-3">
          <h3 className="text-lg font-bold text-gray-800">Resumen de costo por colaborador</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              value={busquedaCostoPivot}
              onChange={e => setBusquedaCostoPivot(e.target.value)}
              placeholder="Buscar colaborador..."
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
            />
            <button
              onClick={exportarCostoPivot}
              disabled={costoColabs.length === 0}
              className="px-4 py-1.5 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#6366F1' }}
            >
              Exportar Excel
            </button>
          </div>
        </div>
      )}

      {/* ── TABLA COSTO PIVOT ── */}
      {!loading && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          {costoColabs.length === 0 ? (
            <p className="text-sm text-gray-400 italic p-4">Sin datos de costo para {añoValidator}.</p>
          ) : (
            <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: '#FFF5F0' }} className="border-b-2 border-gray-300">
                  <FilterableTh
                    col="colaborador" label="Colaborador" align="left" style={{ whiteSpace: 'nowrap' }}
                    opciones={opcionesColaboradorCosto} filtro={filtrosCostoPivot.colaborador || []}
                    onFiltro={setFiltroCostoPivot} dropdownAbierto={dropdownFiltroCostoPivot === 'colaborador'} onToggleDropdown={setDropdownFiltroCostoPivot}
                  />
                  <FilterableTh
                    col="rut" label="RUT" align="left" style={{ whiteSpace: 'nowrap' }}
                    opciones={opcionesRutCosto} filtro={filtrosCostoPivot.rut || []}
                    onFiltro={setFiltroCostoPivot} dropdownAbierto={dropdownFiltroCostoPivot === 'rut'} onToggleDropdown={setDropdownFiltroCostoPivot}
                  />
                  {MESES_CORTOS.map((mc, i) => (
                    <th key={mc} className="py-2 px-3 text-right font-semibold text-gray-800 whitespace-nowrap bg-[#FFF5F0]" title={MESES_NOMBRES[i]}>{mc}</th>
                  ))}
                  <th className="py-2 px-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-orange-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {costoColabsFiltrados.slice(paginaCosto * FILAS_POR_PAGINA, (paginaCosto + 1) * FILAS_POR_PAGINA).map((col, idx) => {
                  const rowTotal = MESES_ABREV.reduce((sum, m) => sum + (costoPivot[col]?.[m] || 0), 0)
                  return (
                    <tr key={col} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                      <td className="py-2 px-4 font-medium text-gray-700 whitespace-nowrap">{col || <span className="text-gray-400 italic">(sin nombre)</span>}</td>
                      <td className="py-2 px-4 text-sm text-gray-500 tabular-nums whitespace-nowrap">{colaboradoresRut[normalize(col)] || <span className="text-gray-300">—</span>}</td>
                      {MESES_ABREV.map(mes => {
                        const c = costoPivot[col]?.[mes] || 0
                        return <td key={mes} className={`py-2 px-3 text-right tabular-nums ${c === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{c === 0 ? '—' : Math.round(c).toLocaleString('es-CL')}</td>
                      })}
                      <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-50 tabular-nums">{Math.round(rowTotal).toLocaleString('es-CL')}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td colSpan={2} className="py-2 px-4 text-gray-800">TOTAL ({costoColabsFiltrados.length})</td>
                  {MESES_ABREV.map(mes => (
                    <td key={mes} className="py-2 px-3 text-right tabular-nums text-gray-800">{costoPorMesFiltrado[mes] === 0 ? '—' : Math.round(costoPorMesFiltrado[mes]).toLocaleString('es-CL')}</td>
                  ))}
                  <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-100 tabular-nums">{Math.round(totalCostoPivotFiltrado).toLocaleString('es-CL')}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
      {!loading && costoColabsFiltrados.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
          <span>{paginaCosto * FILAS_POR_PAGINA + 1}–{Math.min((paginaCosto + 1) * FILAS_POR_PAGINA, costoColabsFiltrados.length)} de {costoColabsFiltrados.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPaginaCosto(p => Math.max(0, p - 1))} disabled={paginaCosto === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPaginaCosto(p => p + 1)} disabled={(paginaCosto + 1) * FILAS_POR_PAGINA >= costoColabsFiltrados.length}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

      {/* ── HEADER COSTO LÍNEA ── */}
      {!loading && (
        <div className="flex-shrink-0 flex justify-between items-center pt-3 pb-1 flex-wrap gap-3">
          <h3 className="text-lg font-bold text-gray-800">Resumen de costo por línea</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              value={busquedaLineaPivot}
              onChange={e => setBusquedaLineaPivot(e.target.value)}
              placeholder="Buscar línea..."
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
            />
            <button
              onClick={exportarCostoLinea}
              disabled={costoLineas.length === 0}
              className="px-4 py-1.5 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#6366F1' }}
            >
              Exportar Excel
            </button>
          </div>
        </div>
      )}

      {/* ── TABLA COSTO LÍNEA ── */}
      {!loading && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          {costoLineas.length === 0 ? (
            <p className="text-sm text-gray-400 italic p-4">Sin datos de costo por línea para {añoValidator}.</p>
          ) : (
            <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: '#FFF5F0' }} className="border-b-2 border-gray-300">
                  <FilterableTh
                    col="linea" label="Línea" align="left" style={{ whiteSpace: 'nowrap' }}
                    opciones={opcionesLineaPivot} filtro={filtrosLineaPivot.linea || []}
                    onFiltro={setFiltroLineaPivot} dropdownAbierto={dropdownFiltroLineaPivot === 'linea'} onToggleDropdown={setDropdownFiltroLineaPivot}
                  />
                  {MESES_CORTOS.map((mc, i) => (
                    <th key={mc} className="py-2 px-3 text-right font-semibold text-gray-800 whitespace-nowrap bg-[#FFF5F0]" title={MESES_NOMBRES[i]}>{mc}</th>
                  ))}
                  <th className="py-2 px-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-orange-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {costoLineasFiltradas.slice(paginaLinea * FILAS_POR_PAGINA, (paginaLinea + 1) * FILAS_POR_PAGINA).map((linea, idx) => {
                  const rowTotal = MESES_ABREV.reduce((sum, m) => sum + (costoLineaPivot[linea]?.[m] || 0), 0)
                  return (
                    <tr key={linea} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                      <td className="py-2 px-4 font-medium text-gray-700 whitespace-nowrap">{linea}</td>
                      {MESES_ABREV.map(mes => {
                        const c = costoLineaPivot[linea]?.[mes] || 0
                        return <td key={mes} className={`py-2 px-3 text-right tabular-nums ${c === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{c === 0 ? '—' : Math.round(c).toLocaleString('es-CL')}</td>
                      })}
                      <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-50 tabular-nums">{Math.round(rowTotal).toLocaleString('es-CL')}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td className="py-2 px-4 text-gray-800">TOTAL ({costoLineasFiltradas.length})</td>
                  {MESES_ABREV.map(mes => (
                    <td key={mes} className="py-2 px-3 text-right tabular-nums text-gray-800">{costoPorMesLineaFiltrado[mes] === 0 ? '—' : Math.round(costoPorMesLineaFiltrado[mes]).toLocaleString('es-CL')}</td>
                  ))}
                  <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-100 tabular-nums">{Math.round(totalCostoLineaFiltrado).toLocaleString('es-CL')}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
      {!loading && costoLineasFiltradas.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
          <span>{paginaLinea * FILAS_POR_PAGINA + 1}–{Math.min((paginaLinea + 1) * FILAS_POR_PAGINA, costoLineasFiltradas.length)} de {costoLineasFiltradas.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPaginaLinea(p => Math.max(0, p - 1))} disabled={paginaLinea === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPaginaLinea(p => p + 1)} disabled={(paginaLinea + 1) * FILAS_POR_PAGINA >= costoLineasFiltradas.length}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

      {/* ── MODAL AGREGAR REGISTRO ── */}
      {modalAgregar && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setModalAgregar(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-5">Agregar registro</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador <span className="text-red-500">*</span></label>
              <input
                type="text"
                list="list-colaboradores"
                value={formAgregar.colaborador}
                onChange={e => setFormAgregar(f => ({ ...f, colaborador: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Nombre del colaborador"
                autoFocus
              />
              <datalist id="list-colaboradores">
                {[...colaboradoresSet].sort().map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto <span className="text-red-500">*</span></label>
              <select
                value={formAgregar.proyecto_id}
                onChange={e => setFormAgregar(f => ({ ...f, proyecto_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Seleccionar proyecto...</option>
                {proyectosLista.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mes <span className="text-red-500">*</span></label>
              <select
                value={formAgregar.mes}
                onChange={e => setFormAgregar(f => ({ ...f, mes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Seleccionar mes...</option>
                {MES_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Horas</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={formAgregar.horas}
                onChange={e => setFormAgregar(f => ({ ...f, horas: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="0"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModalAgregar(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAgregar}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
                style={{ backgroundColor: '#FF5100' }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
