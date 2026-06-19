import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'
import FilterableTh from './FilterableTh'

const MESES_NOMBRES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_ABREV   = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MESES_CORTOS  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function normalize(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

function mesToNum(mes) {
  if (!mes) return 0
  const [abrev, año] = mes.split('-')
  const añoNum = parseInt(año || 0)
  const añoFull = añoNum < 100 ? añoNum + 2000 : añoNum
  return añoFull * 100 + (MESES_ABREV.indexOf((abrev || '').toLowerCase()) + 1)
}

function buildTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

const FILAS_POR_PAGINA = 20

export default function VistaConsolidado() {
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [proyectosLinea, setProyectosLinea] = useState({})
  const [colaboradoresCosto, setColaboradoresCosto] = useState({})
  const [colaboradoresRut, setColaboradoresRut] = useState({})
  const [añoValidator, setAñoValidator] = useState(new Date().getFullYear())

  // Real data maps
  const [horasRealesColabMap, setHorasRealesColabMap] = useState({})       // { normColab → { mes → monto } }
  const [horasRealesColabProyMap, setHorasRealesColabProyMap] = useState({}) // { normColab|||normProy → { mes → monto } }
  const [realPairsNames, setRealPairsNames] = useState({})                 // { normColab|||normProy → { colabName, proyName } }
  const [mesesCubiertosHH, setMesesCubiertosHH] = useState(new Set())

  // Filter states — validador (horas por colaborador)
  const [busquedaValidator, setBusquedaValidator] = useState('')
  const [filtrosValidator, setFiltrosValidator] = useState({})
  const [dropdownFiltroValidator, setDropdownFiltroValidator] = useState(null)
  const [paginaValidator, setPaginaValidator] = useState(0)

  // Filter states — costo por colaborador
  const [busquedaCosto, setBusquedaCosto] = useState('')
  const [filtrosCosto, setFiltrosCosto] = useState({})
  const [dropdownFiltroCosto, setDropdownFiltroCosto] = useState(null)
  const [paginaCosto, setPaginaCosto] = useState(0)

  // Filter states — costo por línea
  const [busquedaLinea, setBusquedaLinea] = useState('')
  const [filtrosLinea, setFiltrosLinea] = useState({})
  const [dropdownFiltroLinea, setDropdownFiltroLinea] = useState(null)
  const [paginaLinea, setPaginaLinea] = useState(0)

  // Filter states — detalle horas (colabXproy)
  const [busquedaDetalle, setBusquedaDetalle] = useState('')
  const [filtrosDetalle, setFiltrosDetalle] = useState({})
  const [dropdownFiltroDetalle, setDropdownFiltroDetalle] = useState(null)
  const [paginaDetalle, setPaginaDetalle] = useState(0)
  const [paginaMonto, setPaginaMonto] = useState(0)

  useEffect(() => {
    cargarDatos()
    cargarValidaciones()
    cargarMesesCubiertos()
    cargarHorasReales()
  }, [])

  useEffect(() => {
    if (!dropdownFiltroValidator) return
    function c() { setDropdownFiltroValidator(null) }
    document.addEventListener('click', c)
    return () => document.removeEventListener('click', c)
  }, [dropdownFiltroValidator])

  useEffect(() => {
    if (!dropdownFiltroCosto) return
    function c() { setDropdownFiltroCosto(null) }
    document.addEventListener('click', c)
    return () => document.removeEventListener('click', c)
  }, [dropdownFiltroCosto])

  useEffect(() => {
    if (!dropdownFiltroLinea) return
    function c() { setDropdownFiltroLinea(null) }
    document.addEventListener('click', c)
    return () => document.removeEventListener('click', c)
  }, [dropdownFiltroLinea])

  useEffect(() => {
    if (!dropdownFiltroDetalle) return
    function c() { setDropdownFiltroDetalle(null) }
    document.addEventListener('click', c)
    return () => document.removeEventListener('click', c)
  }, [dropdownFiltroDetalle])

  useEffect(() => { setPaginaValidator(0) }, [busquedaValidator, filtrosValidator, añoValidator])
  useEffect(() => { setPaginaCosto(0) }, [busquedaCosto, filtrosCosto, añoValidator])
  useEffect(() => { setPaginaLinea(0) }, [busquedaLinea, filtrosLinea, añoValidator])
  useEffect(() => { setPaginaDetalle(0); setPaginaMonto(0) }, [busquedaDetalle, filtrosDetalle, añoValidator])

  async function cargarDatos() {
    setLoading(true)
    const PAGE = 1000
    let todas = [], from = 0
    while (true) {
      const { data, error } = await supabase
        .from('horas_proyectadas')
        .select('*')
        .range(from, from + PAGE - 1)
      if (error) { console.error(error); break }
      todas = [...todas, ...(data || [])]
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    setFilas(todas)
    setLoading(false)
  }

  async function cargarValidaciones() {
    const [{ data: cols }, { data: proyectos }] = await Promise.all([
      supabase.from('colaboradores').select('colaborador, rut'),
      supabase.from('proyectos').select('id, nombre, ceco').order('nombre'),
    ])
    const rutMap = {}
    for (const c of (cols || [])) rutMap[normalize(c.colaborador)] = c.rut || ''
    setColaboradoresRut(rutMap)
    const lineasMap = {}
    for (const p of (proyectos || [])) lineasMap[normalize(p.nombre)] = p.ceco || ''
    setProyectosLinea(lineasMap)

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

  async function cargarMesesCubiertos() {
    const { data } = await supabase.from('hh_acumulado_real').select('mes').not('mes', 'is', null).neq('mes', '')
    setMesesCubiertosHH(new Set((data || []).map(r => r.mes).filter(Boolean)))
  }

  async function cargarHorasReales() {
    const PAGE = 1000
    let todas = [], from = 0
    while (true) {
      const { data, error } = await supabase.from('hh_acumulado_real')
        .select('nombre, nombre_proyecto, mes, monto_hh_real')
        .range(from, from + PAGE - 1)
      if (error) { console.error('[real] Error:', error); break }
      if (!data?.length) break
      todas = [...todas, ...data]
      if (data.length < PAGE) break
      from += PAGE
    }
    const mapColab = {}       // normColab → { mesAbrev → monto }
    const mapColabProy = {}   // normColab|||normProy → { mesAbrev → monto }
    const pairsNames = {}     // normColab|||normProy → { colabName, proyName }

    for (const r of todas) {
      const normColab = normalize(r.nombre || '')
      const normProy  = normalize(r.nombre_proyecto || '')
      const mesAbrev  = (r.mes || '').split('-')[0].toLowerCase()
      const monto     = parseFloat(r.monto_hh_real) || 0
      if (!normColab || !mesAbrev) continue

      if (!mapColab[normColab]) mapColab[normColab] = {}
      mapColab[normColab][mesAbrev] = (mapColab[normColab][mesAbrev] || 0) + monto

      if (normProy) {
        const pairKey = normColab + '|||' + normProy
        if (!mapColabProy[pairKey]) mapColabProy[pairKey] = {}
        mapColabProy[pairKey][mesAbrev] = (mapColabProy[pairKey][mesAbrev] || 0) + monto
        if (!pairsNames[pairKey]) {
          pairsNames[pairKey] = {
            colabName: (r.nombre || '').trim().replace(/\s+/g, ' '),
            proyName:  (r.nombre_proyecto || '').trim().replace(/\s+/g, ' '),
          }
        }
      }
    }
    setHorasRealesColabMap(mapColab)
    setHorasRealesColabProyMap(mapColabProy)
    setRealPairsNames(pairsNames)
  }

  // ── Meses cubiertos para el año seleccionado ──
  const mesesCubiertosAbrev = new Set(
    [...mesesCubiertosHH].flatMap(mes => {
      const [abrev, anio] = mes.split('-')
      const anioFull = parseInt(anio || 0) + (parseInt(anio || 0) < 100 ? 2000 : 0)
      return anioFull === añoValidator ? [abrev.toLowerCase()] : []
    })
  )

  const año2d = String(añoValidator).slice(-2)

  function mesHeaderCls(abrev) {
    return mesesCubiertosAbrev.has(abrev)
      ? 'py-2 px-3 text-right font-semibold text-white whitespace-nowrap bg-gray-600'
      : 'py-2 px-3 text-right font-semibold text-gray-800 whitespace-nowrap bg-[#FFF5F0]'
  }

  const añosDisponibles = [...new Set(
    filas.map(f => {
      const a = parseInt((f.mes || '').split('-')[1] || '0')
      return a < 100 ? a + 2000 : a
    }).filter(Boolean)
  )].sort()

  // ── VALIDADOR: horas proyectadas por colaborador (solo de horas_proyectadas) ──
  const validatorPivot = {}
  for (const f of filas) {
    const [abrev, añoCorto] = (f.mes || '').split('-')
    const añoFull = parseInt(añoCorto || '0') + (parseInt(añoCorto || '0') < 100 ? 2000 : 0)
    if (añoFull !== añoValidator) continue
    const mesKey = (abrev || '').toLowerCase()
    if (!MESES_ABREV.includes(mesKey)) continue
    if (!validatorPivot[f.colaborador]) validatorPivot[f.colaborador] = {}
    validatorPivot[f.colaborador][mesKey] = (validatorPivot[f.colaborador][mesKey] || 0) + (parseFloat(f.horas) || 0)
  }
  const validatorColabs = Object.keys(validatorPivot).sort((a, b) => a.localeCompare(b, 'es'))

  const totalHorasPorMes = {}
  for (const mes of MESES_ABREV) {
    totalHorasPorMes[mes] = validatorColabs.reduce((sum, c) => sum + (validatorPivot[c]?.[mes] || 0), 0)
  }
  const totalHorasGeneral = MESES_ABREV.reduce((sum, m) => sum + totalHorasPorMes[m], 0)

  // ── COSTO CONSOLIDADO: por colaborador — cubiertos=real, no cubiertos=proyectado ──
  // Colaboradores = unión de proyectados y reales
  const proyColabsNorm = new Set(validatorColabs.map(c => normalize(c)))
  const realColabsNorm = new Set(Object.keys(horasRealesColabMap))
  const unionColabsNorm = new Set([...proyColabsNorm, ...realColabsNorm])

  // Mapa normColab → displayName (prefer name from projected; else from real)
  const colabDisplayName = {}
  for (const c of validatorColabs) colabDisplayName[normalize(c)] = c
  for (const pairKey of Object.keys(realPairsNames)) {
    const normC = pairKey.split('|||')[0]
    if (!colabDisplayName[normC]) colabDisplayName[normC] = realPairsNames[pairKey].colabName
  }

  // costoPivot: solo datos proyectados (para meses no cubiertos)
  const costoPivotProy = {}
  for (const f of filas) {
    const [abrev, añoCorto] = (f.mes || '').split('-')
    const añoFull = parseInt(añoCorto || '0') + (parseInt(añoCorto || '0') < 100 ? 2000 : 0)
    if (añoFull !== añoValidator) continue
    const mesKey = (abrev || '').toLowerCase()
    if (!MESES_ABREV.includes(mesKey)) continue
    const normC = normalize(f.colaborador)
    const costo = (parseFloat(f.horas) || 0) * (colaboradoresCosto[normC]?.[f.mes] || 0)
    if (!costoPivotProy[normC]) costoPivotProy[normC] = {}
    costoPivotProy[normC][mesKey] = (costoPivotProy[normC][mesKey] || 0) + costo
  }

  function costoColabMes(normC, mes) {
    if (mesesCubiertosAbrev.has(mes)) return horasRealesColabMap[normC]?.[mes] || 0
    return costoPivotProy[normC]?.[mes] || 0
  }

  const costoColabs = [...unionColabsNorm]
    .map(normC => colabDisplayName[normC] || normC)
    .sort((a, b) => a.localeCompare(b, 'es'))

  const costoPorMes = {}
  for (const mes of MESES_ABREV) {
    costoPorMes[mes] = costoColabs.reduce((sum, col) => sum + costoColabMes(normalize(col), mes), 0)
  }
  const totalCostoPivot = MESES_ABREV.reduce((sum, m) => sum + costoPorMes[m], 0)

  // ── COSTO POR LÍNEA CONSOLIDADO ──
  // Líneas desde proyectado (meses no cubiertos) + real (meses cubiertos)
  const horasRealesLineaMap = {}
  for (const [pairKey, meses] of Object.entries(horasRealesColabProyMap)) {
    const normProy = pairKey.split('|||')[1]
    const linea = proyectosLinea[normProy] || ''
    if (!linea) continue
    if (!horasRealesLineaMap[linea]) horasRealesLineaMap[linea] = {}
    for (const [mes, monto] of Object.entries(meses)) {
      horasRealesLineaMap[linea][mes] = (horasRealesLineaMap[linea][mes] || 0) + monto
    }
  }

  const costoLineaPivot = {}
  for (const f of filas) {
    const [abrev, añoCorto] = (f.mes || '').split('-')
    const añoFull = parseInt(añoCorto || '0') + (parseInt(añoCorto || '0') < 100 ? 2000 : 0)
    if (añoFull !== añoValidator) continue
    const mesKey = (abrev || '').toLowerCase()
    if (!MESES_ABREV.includes(mesKey)) continue
    if (mesesCubiertosAbrev.has(mesKey)) continue
    const linea = proyectosLinea[normalize(f.proyecto)] || ''
    if (!linea) continue
    const costo = (parseFloat(f.horas) || 0) * (colaboradoresCosto[normalize(f.colaborador)]?.[f.mes] || 0)
    if (!costoLineaPivot[linea]) costoLineaPivot[linea] = {}
    costoLineaPivot[linea][mesKey] = (costoLineaPivot[linea][mesKey] || 0) + costo
  }
  for (const [linea, meses] of Object.entries(horasRealesLineaMap)) {
    for (const mes of MESES_ABREV) {
      if (!mesesCubiertosAbrev.has(mes)) continue
      const real = meses[mes] || 0
      if (real === 0) continue
      if (!costoLineaPivot[linea]) costoLineaPivot[linea] = {}
      costoLineaPivot[linea][mes] = (costoLineaPivot[linea][mes] || 0) + real
    }
  }
  const costoLineas = Object.keys(costoLineaPivot).sort((a, b) => a.localeCompare(b, 'es'))
  const costoPorMesLinea = {}
  for (const mes of MESES_ABREV) {
    costoPorMesLinea[mes] = costoLineas.reduce((sum, l) => sum + (costoLineaPivot[l]?.[mes] || 0), 0)
  }
  const totalCostoLinea = MESES_ABREV.reduce((sum, m) => sum + costoPorMesLinea[m], 0)

  // ── DETALLE CONSOLIDADO: horas por colaborador × proyecto (UNIÓN real + proyectado) ──
  const detallePivot = {}

  // Fase 1: de horas_proyectadas
  for (const f of filas) {
    const [abrev, añoCorto] = (f.mes || '').split('-')
    const añoFull = parseInt(añoCorto || '0') + (parseInt(añoCorto || '0') < 100 ? 2000 : 0)
    if (añoFull !== añoValidator) continue
    const mesKey = (abrev || '').toLowerCase()
    if (!MESES_ABREV.includes(mesKey)) continue
    const pairKey = normalize(f.colaborador) + '|||' + normalize(f.proyecto)
    if (!detallePivot[pairKey]) detallePivot[pairKey] = { colaborador: f.colaborador, proyecto: f.proyecto }
    detallePivot[pairKey][mesKey] = (detallePivot[pairKey][mesKey] || 0) + (parseFloat(f.horas) || 0)
  }

  // Fase 2: agrega pares que solo existen en hh_acumulado_real
  for (const [pairKey, names] of Object.entries(realPairsNames)) {
    if (!detallePivot[pairKey]) {
      detallePivot[pairKey] = { colaborador: names.colabName, proyecto: names.proyName }
    }
  }

  const detalleFilas = Object.entries(detallePivot)
    .map(([, row]) => row)
    .sort((a, b) => {
      const colCmp = (a.colaborador || '').localeCompare(b.colaborador || '', 'es')
      if (colCmp !== 0) return colCmp
      return (a.proyecto || '').localeCompare(b.proyecto || '', 'es')
    })

  // Para la tabla monto, usa datos exactos por (colab, proyecto) del real
  function montoFila(row, mes) {
    if (mesesCubiertosAbrev.has(mes)) {
      const pairKey = normalize(row.colaborador) + '|||' + normalize(row.proyecto)
      return horasRealesColabProyMap[pairKey]?.[mes] || 0
    }
    const h = row[mes] || 0
    const costo = colaboradoresCosto[normalize(row.colaborador)]?.[`${mes}-${año2d}`] || 0
    return h * costo
  }

  // ── Opciones de filtro ──
  const opcionesColaboradorValidator = [...validatorColabs]
  const opcionesRutValidator = [...new Set(validatorColabs.map(c => colaboradoresRut[normalize(c)] || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const opcionesColaboradorCosto = [...costoColabs]
  const opcionesRutCosto = [...new Set(costoColabs.map(c => colaboradoresRut[normalize(c)] || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const opcionesLineaPivot = [...costoLineas]
  const opcionesColaboradorDetalle = [...new Set(detalleFilas.map(r => r.colaborador))].sort((a, b) => a.localeCompare(b, 'es'))
  const opcionesProyectoDetalle    = [...new Set(detalleFilas.map(r => r.proyecto))].sort((a, b) => a.localeCompare(b, 'es'))
  const opcionesLineaDetalle       = [...new Set(detalleFilas.map(r => proyectosLinea[normalize(r.proyecto)] || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))

  // ── Filtros aplicados ──
  const validatorColabsFiltrados = validatorColabs.filter(col => {
    const q = busquedaValidator.toLowerCase()
    const rut = colaboradoresRut[normalize(col)] || ''
    const matchBusqueda = !q || [col, rut].some(v => v.toLowerCase().includes(q))
    const matchCol = !filtrosValidator.colaborador?.length || filtrosValidator.colaborador.includes(col)
    const matchRut = !filtrosValidator.rut?.length || filtrosValidator.rut.includes(rut)
    return matchBusqueda && matchCol && matchRut
  })
  const totalHorasPorMesFiltrado = {}
  for (const mes of MESES_ABREV) {
    totalHorasPorMesFiltrado[mes] = validatorColabsFiltrados.reduce((sum, c) => sum + (validatorPivot[c]?.[mes] || 0), 0)
  }
  const totalHorasFiltrado = MESES_ABREV.reduce((sum, m) => sum + totalHorasPorMesFiltrado[m], 0)

  const costoColabsFiltrados = costoColabs.filter(col => {
    const q = busquedaCosto.toLowerCase()
    const rut = colaboradoresRut[normalize(col)] || ''
    const matchBusqueda = !q || [col, rut].some(v => v.toLowerCase().includes(q))
    const matchCol = !filtrosCosto.colaborador?.length || filtrosCosto.colaborador.includes(col)
    const matchRut = !filtrosCosto.rut?.length || filtrosCosto.rut.includes(rut)
    return matchBusqueda && matchCol && matchRut
  })
  const costoPorMesFiltrado = {}
  for (const mes of MESES_ABREV) {
    costoPorMesFiltrado[mes] = costoColabsFiltrados.reduce((sum, c) => sum + costoColabMes(normalize(c), mes), 0)
  }
  const totalCostoPivotFiltrado = MESES_ABREV.reduce((sum, m) => sum + costoPorMesFiltrado[m], 0)

  const costoLineasFiltradas = costoLineas.filter(linea => {
    const q = busquedaLinea.toLowerCase()
    const matchBusqueda = !q || linea.toLowerCase().includes(q)
    const matchLinea = !filtrosLinea.linea?.length || filtrosLinea.linea.includes(linea)
    return matchBusqueda && matchLinea
  })
  const costoPorMesLineaFiltrado = {}
  for (const mes of MESES_ABREV) {
    costoPorMesLineaFiltrado[mes] = costoLineasFiltradas.reduce((sum, l) => sum + (costoLineaPivot[l]?.[mes] || 0), 0)
  }
  const totalCostoLineaFiltrado = MESES_ABREV.reduce((sum, m) => sum + costoPorMesLineaFiltrado[m], 0)

  const detalleFilasFiltradas = detalleFilas.filter(row => {
    const q = busquedaDetalle.toLowerCase()
    const linea = proyectosLinea[normalize(row.proyecto)] || ''
    const matchBusqueda = !q || [row.colaborador, row.proyecto, linea].some(v => (v || '').toLowerCase().includes(q))
    const matchCol  = !filtrosDetalle.colaborador?.length || filtrosDetalle.colaborador.includes(row.colaborador)
    const matchProy = !filtrosDetalle.proyecto?.length    || filtrosDetalle.proyecto.includes(row.proyecto)
    const matchLinea = !filtrosDetalle.linea?.length      || filtrosDetalle.linea.includes(linea)
    return matchBusqueda && matchCol && matchProy && matchLinea
  })
  const detalleTotalPorMes = {}
  for (const mes of MESES_ABREV) {
    detalleTotalPorMes[mes] = detalleFilasFiltradas.reduce((sum, r) => sum + (r[mes] || 0), 0)
  }
  const detalleTotalGeneral = MESES_ABREV.reduce((sum, m) => sum + detalleTotalPorMes[m], 0)

  const montoTotalPorMes = {}
  for (const mes of MESES_ABREV) {
    montoTotalPorMes[mes] = detalleFilasFiltradas.reduce((sum, r) => sum + montoFila(r, mes), 0)
  }
  const montoTotalGeneral = MESES_ABREV.reduce((sum, m) => sum + montoTotalPorMes[m], 0)

  // ── Exportar ──
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
    MESES_ABREV.forEach((abrev, i) => { rowTotal[MESES_NOMBRES[i].toUpperCase()] = totalHorasPorMes[abrev]; })
    rowTotal['TOTAL'] = totalHorasGeneral
    rows.push(rowTotal)
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `HorasProyectadas_${añoValidator}`)
    XLSX.writeFile(wb, `horas_proyectadas_resumen_${añoValidator}_${buildTimestamp()}.xlsx`)
  }

  function exportarCostoPivot() {
    const rows = costoColabs.map(col => {
      const normC = normalize(col)
      const row = { COLABORADOR: col, RUT: colaboradoresRut[normC] || '' }
      let total = 0
      MESES_ABREV.forEach((abrev, i) => {
        const c = costoColabMes(normC, abrev)
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
    XLSX.utils.book_append_sheet(wb, ws, `CostoColaborador_${añoValidator}`)
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
    XLSX.utils.book_append_sheet(wb, ws, `CostoLinea_${añoValidator}`)
    XLSX.writeFile(wb, `costo_linea_${añoValidator}_${buildTimestamp()}.xlsx`)
  }

  // ── Selector de año compartido ──
  function SelectorAño() {
    return (
      <div className="flex items-center gap-2">
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
      </div>
    )
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>

  return (
    <div className="flex flex-col gap-0">

      {/* ── RESUMEN POR COLABORADOR (horas proyectadas) ── */}
      <div className="flex-shrink-0 flex justify-between items-center pb-1 flex-wrap gap-3">
        <h3 className="text-lg font-bold text-gray-800">Resumen por colaborador</h3>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            value={busquedaValidator}
            onChange={e => setBusquedaValidator(e.target.value)}
            placeholder="Buscar colaborador..."
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
          />
          <SelectorAño />
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
                  onFiltro={(col, val) => setFiltrosValidator(prev => ({ ...prev, [col]: val }))}
                  dropdownAbierto={dropdownFiltroValidator === 'colaborador'} onToggleDropdown={setDropdownFiltroValidator}
                />
                <FilterableTh
                  col="rut" label="RUT" align="left" style={{ whiteSpace: 'nowrap' }}
                  opciones={opcionesRutValidator} filtro={filtrosValidator.rut || []}
                  onFiltro={(col, val) => setFiltrosValidator(prev => ({ ...prev, [col]: val }))}
                  dropdownAbierto={dropdownFiltroValidator === 'rut'} onToggleDropdown={setDropdownFiltroValidator}
                />
                {MESES_CORTOS.map((mc, i) => (
                  <th key={mc} className={mesHeaderCls(MESES_ABREV[i])} title={MESES_NOMBRES[i]}>{mc}</th>
                ))}
                <th className="py-2 px-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-orange-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {validatorColabsFiltrados.slice(paginaValidator * FILAS_POR_PAGINA, (paginaValidator + 1) * FILAS_POR_PAGINA).map((col, idx) => {
                const rowTotal = MESES_ABREV.reduce((sum, m) => sum + (validatorPivot[col]?.[m] || 0), 0)
                return (
                  <tr key={col} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                    <td className="py-2 px-4 font-medium text-gray-700 whitespace-nowrap">{col}</td>
                    <td className="py-2 px-4 text-sm text-gray-500 tabular-nums whitespace-nowrap">{colaboradoresRut[normalize(col)] || <span className="text-gray-300">—</span>}</td>
                    {MESES_ABREV.map(mes => {
                      const h = validatorPivot[col]?.[mes] || 0
                      const cubierto = mesesCubiertosAbrev.has(mes)
                      return <td key={mes} className={`py-2 px-3 text-right tabular-nums ${cubierto ? 'bg-gray-100 text-gray-400' : h === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{h === 0 ? '0,00' : h.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    })}
                    <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-50 tabular-nums">{rowTotal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                <td colSpan={2} className="py-2 px-4 text-gray-800">TOTAL ({validatorColabsFiltrados.length})</td>
                {MESES_ABREV.map(mes => (
                  <td key={mes} className={`py-2 px-3 text-right tabular-nums text-gray-800 ${mesesCubiertosAbrev.has(mes) ? 'bg-gray-200' : ''}`}>{totalHorasPorMesFiltrado[mes] === 0 ? '0,00' : totalHorasPorMesFiltrado[mes].toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                ))}
                <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-100 tabular-nums">{totalHorasFiltrado.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {validatorColabsFiltrados.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
          <span>{paginaValidator * FILAS_POR_PAGINA + 1}–{Math.min((paginaValidator + 1) * FILAS_POR_PAGINA, validatorColabsFiltrados.length)} de {validatorColabsFiltrados.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPaginaValidator(p => Math.max(0, p - 1))} disabled={paginaValidator === 0} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPaginaValidator(p => p + 1)} disabled={(paginaValidator + 1) * FILAS_POR_PAGINA >= validatorColabsFiltrados.length} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

      {/* ── RESUMEN DE COSTO POR COLABORADOR ── */}
      <div className="flex-shrink-0 flex justify-between items-center pt-6 pb-1 flex-wrap gap-3">
        <h3 className="text-lg font-bold text-gray-800">Resumen de costo por colaborador</h3>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            value={busquedaCosto}
            onChange={e => setBusquedaCosto(e.target.value)}
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

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        {costoColabs.length === 0 ? (
          <p className="text-sm text-gray-400 italic p-4">Sin datos de costo para {añoValidator}.</p>
        ) : (
          <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: '#FFF5F0' }} className="border-b-2 border-gray-300">
                <FilterableTh
                  col="colaborador" label="Colaborador" align="left" style={{ whiteSpace: 'nowrap' }}
                  opciones={opcionesColaboradorCosto} filtro={filtrosCosto.colaborador || []}
                  onFiltro={(col, val) => setFiltrosCosto(prev => ({ ...prev, [col]: val }))}
                  dropdownAbierto={dropdownFiltroCosto === 'colaborador'} onToggleDropdown={setDropdownFiltroCosto}
                />
                <FilterableTh
                  col="rut" label="RUT" align="left" style={{ whiteSpace: 'nowrap' }}
                  opciones={opcionesRutCosto} filtro={filtrosCosto.rut || []}
                  onFiltro={(col, val) => setFiltrosCosto(prev => ({ ...prev, [col]: val }))}
                  dropdownAbierto={dropdownFiltroCosto === 'rut'} onToggleDropdown={setDropdownFiltroCosto}
                />
                {MESES_CORTOS.map((mc, i) => (
                  <th key={mc} className={mesHeaderCls(MESES_ABREV[i])} title={MESES_NOMBRES[i]}>{mc}</th>
                ))}
                <th className="py-2 px-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-orange-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {costoColabsFiltrados.slice(paginaCosto * FILAS_POR_PAGINA, (paginaCosto + 1) * FILAS_POR_PAGINA).map((col, idx) => {
                const normC = normalize(col)
                const rowTotal = MESES_ABREV.reduce((sum, m) => sum + costoColabMes(normC, m), 0)
                return (
                  <tr key={col} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                    <td className="py-2 px-4 font-medium text-gray-700 whitespace-nowrap">{col}</td>
                    <td className="py-2 px-4 text-sm text-gray-500 tabular-nums whitespace-nowrap">{colaboradoresRut[normC] || <span className="text-gray-300">—</span>}</td>
                    {MESES_ABREV.map(mes => {
                      const c = costoColabMes(normC, mes)
                      const cubierto = mesesCubiertosAbrev.has(mes)
                      return <td key={mes} className={`py-2 px-3 text-right tabular-nums ${cubierto ? 'bg-gray-100 text-gray-400' : c === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{c === 0 ? '—' : Math.round(c).toLocaleString('es-CL')}</td>
                    })}
                    <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-50 tabular-nums">{Math.round(rowTotal).toLocaleString('es-CL')}</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                <td colSpan={2} className="py-2 px-4 text-gray-800">TOTAL ({costoColabsFiltrados.length})</td>
                {MESES_ABREV.map(mes => (
                  <td key={mes} className={`py-2 px-3 text-right tabular-nums text-gray-800 ${mesesCubiertosAbrev.has(mes) ? 'bg-gray-200' : ''}`}>{costoPorMesFiltrado[mes] === 0 ? '—' : Math.round(costoPorMesFiltrado[mes]).toLocaleString('es-CL')}</td>
                ))}
                <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-100 tabular-nums">{Math.round(totalCostoPivotFiltrado).toLocaleString('es-CL')}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {costoColabsFiltrados.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
          <span>{paginaCosto * FILAS_POR_PAGINA + 1}–{Math.min((paginaCosto + 1) * FILAS_POR_PAGINA, costoColabsFiltrados.length)} de {costoColabsFiltrados.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPaginaCosto(p => Math.max(0, p - 1))} disabled={paginaCosto === 0} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPaginaCosto(p => p + 1)} disabled={(paginaCosto + 1) * FILAS_POR_PAGINA >= costoColabsFiltrados.length} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

      {/* ── RESUMEN DE COSTO POR LÍNEA ── */}
      <div className="flex-shrink-0 flex justify-between items-center pt-6 pb-1 flex-wrap gap-3">
        <h3 className="text-lg font-bold text-gray-800">Resumen de costo por línea</h3>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            value={busquedaLinea}
            onChange={e => setBusquedaLinea(e.target.value)}
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

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        {costoLineas.length === 0 ? (
          <p className="text-sm text-gray-400 italic p-4">Sin datos por línea para {añoValidator}.</p>
        ) : (
          <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: '#FFF5F0' }} className="border-b-2 border-gray-300">
                <FilterableTh
                  col="linea" label="Línea" align="left" style={{ whiteSpace: 'nowrap' }}
                  opciones={opcionesLineaPivot} filtro={filtrosLinea.linea || []}
                  onFiltro={(col, val) => setFiltrosLinea(prev => ({ ...prev, [col]: val }))}
                  dropdownAbierto={dropdownFiltroLinea === 'linea'} onToggleDropdown={setDropdownFiltroLinea}
                />
                {MESES_CORTOS.map((mc, i) => (
                  <th key={mc} className={mesHeaderCls(MESES_ABREV[i])} title={MESES_NOMBRES[i]}>{mc}</th>
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
                      const cubierto = mesesCubiertosAbrev.has(mes)
                      return <td key={mes} className={`py-2 px-3 text-right tabular-nums ${cubierto ? 'bg-gray-100 text-gray-400' : c === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{c === 0 ? '—' : Math.round(c).toLocaleString('es-CL')}</td>
                    })}
                    <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-50 tabular-nums">{Math.round(rowTotal).toLocaleString('es-CL')}</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                <td className="py-2 px-4 text-gray-800">TOTAL ({costoLineasFiltradas.length})</td>
                {MESES_ABREV.map(mes => (
                  <td key={mes} className={`py-2 px-3 text-right tabular-nums text-gray-800 ${mesesCubiertosAbrev.has(mes) ? 'bg-gray-200' : ''}`}>{costoPorMesLineaFiltrado[mes] === 0 ? '—' : Math.round(costoPorMesLineaFiltrado[mes]).toLocaleString('es-CL')}</td>
                ))}
                <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-100 tabular-nums">{Math.round(totalCostoLineaFiltrado).toLocaleString('es-CL')}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {costoLineasFiltradas.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
          <span>{paginaLinea * FILAS_POR_PAGINA + 1}–{Math.min((paginaLinea + 1) * FILAS_POR_PAGINA, costoLineasFiltradas.length)} de {costoLineasFiltradas.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPaginaLinea(p => Math.max(0, p - 1))} disabled={paginaLinea === 0} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPaginaLinea(p => p + 1)} disabled={(paginaLinea + 1) * FILAS_POR_PAGINA >= costoLineasFiltradas.length} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

      {/* ── HORAS POR COLABORADOR × PROYECTO (UNIÓN) ── */}
      <div className="flex-shrink-0 flex justify-between items-center pt-6 pb-1 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Horas por colaborador y proyecto</h3>
          <p className="text-xs text-gray-400 mt-0.5">Incluye todos los proyectos con horas reales o proyectadas</p>
        </div>
        <input
          type="text"
          value={busquedaDetalle}
          onChange={e => setBusquedaDetalle(e.target.value)}
          placeholder="Buscar..."
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
        />
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        {detalleFilas.length === 0 ? (
          <p className="text-sm text-gray-400 italic p-4">Sin datos para {añoValidator}.</p>
        ) : (
          <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: '#FFF5F0' }} className="border-b-2 border-gray-300">
                <FilterableTh
                  col="colaborador" label="Colaborador" align="left" style={{ whiteSpace: 'nowrap' }}
                  opciones={opcionesColaboradorDetalle} filtro={filtrosDetalle.colaborador || []}
                  onFiltro={(col, val) => setFiltrosDetalle(prev => ({ ...prev, [col]: val }))}
                  dropdownAbierto={dropdownFiltroDetalle === 'colaborador'} onToggleDropdown={setDropdownFiltroDetalle}
                />
                <FilterableTh
                  col="proyecto" label="Proyecto" align="left" style={{ whiteSpace: 'nowrap' }}
                  opciones={opcionesProyectoDetalle} filtro={filtrosDetalle.proyecto || []}
                  onFiltro={(col, val) => setFiltrosDetalle(prev => ({ ...prev, [col]: val }))}
                  dropdownAbierto={dropdownFiltroDetalle === 'proyecto'} onToggleDropdown={setDropdownFiltroDetalle}
                />
                <FilterableTh
                  col="linea" label="Línea" align="left" style={{ whiteSpace: 'nowrap' }}
                  opciones={opcionesLineaDetalle} filtro={filtrosDetalle.linea || []}
                  onFiltro={(col, val) => setFiltrosDetalle(prev => ({ ...prev, [col]: val }))}
                  dropdownAbierto={dropdownFiltroDetalle === 'linea'} onToggleDropdown={setDropdownFiltroDetalle}
                />
                {MESES_CORTOS.map((mc, i) => (
                  <th key={mc} className={mesHeaderCls(MESES_ABREV[i])} title={MESES_NOMBRES[i]}>{mc}</th>
                ))}
                <th className="py-2 px-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-orange-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {detalleFilasFiltradas.slice(paginaDetalle * FILAS_POR_PAGINA, (paginaDetalle + 1) * FILAS_POR_PAGINA).map((row, idx) => {
                const linea = proyectosLinea[normalize(row.proyecto)] || ''
                const rowTotal = MESES_ABREV.reduce((sum, m) => sum + (row[m] || 0), 0)
                return (
                  <tr key={`${row.colaborador}|||${row.proyecto}`} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                    <td className="py-2 px-4 font-medium text-gray-700 whitespace-nowrap">{row.colaborador}</td>
                    <td className="py-2 px-4 text-gray-700 whitespace-nowrap">{row.proyecto}</td>
                    <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{linea || <span className="text-gray-300">—</span>}</td>
                    {MESES_ABREV.map(mes => {
                      const h = row[mes] || 0
                      const cubierto = mesesCubiertosAbrev.has(mes)
                      return (
                        <td key={mes} className={`py-2 px-3 text-right tabular-nums ${cubierto ? 'bg-gray-100 text-gray-400' : h === 0 ? 'text-gray-300' : 'text-gray-700'}`}>
                          {h === 0 ? '—' : h.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      )
                    })}
                    <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-50 tabular-nums">{rowTotal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                <td colSpan={3} className="py-2 px-4 text-gray-800">TOTAL ({detalleFilasFiltradas.length})</td>
                {MESES_ABREV.map(mes => (
                  <td key={mes} className={`py-2 px-3 text-right tabular-nums text-gray-800 ${mesesCubiertosAbrev.has(mes) ? 'bg-gray-200' : ''}`}>{detalleTotalPorMes[mes] === 0 ? '—' : detalleTotalPorMes[mes].toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                ))}
                <td className="py-2 px-4 text-right font-bold text-gray-800 bg-orange-100 tabular-nums">{detalleTotalGeneral.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {detalleFilasFiltradas.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
          <span>{paginaDetalle * FILAS_POR_PAGINA + 1}–{Math.min((paginaDetalle + 1) * FILAS_POR_PAGINA, detalleFilasFiltradas.length)} de {detalleFilasFiltradas.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPaginaDetalle(p => Math.max(0, p - 1))} disabled={paginaDetalle === 0} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPaginaDetalle(p => p + 1)} disabled={(paginaDetalle + 1) * FILAS_POR_PAGINA >= detalleFilasFiltradas.length} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

      {/* ── MONTO POR COLABORADOR × PROYECTO (UNIÓN) ── */}
      <div className="flex-shrink-0 flex justify-between items-center pt-6 pb-1 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Monto por colaborador y proyecto</h3>
          <span className="text-xs text-gray-400">Meses cubiertos = monto real; resto = horas proyectadas × costo</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        {detalleFilas.length === 0 ? (
          <p className="text-sm text-gray-400 italic p-4">Sin datos para {añoValidator}.</p>
        ) : (
          <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: '#F0F9FF' }} className="border-b-2 border-gray-300">
                <th className="py-2 px-4 text-left font-semibold text-gray-800 whitespace-nowrap">Colaborador</th>
                <th className="py-2 px-4 text-left font-semibold text-gray-800 whitespace-nowrap">Proyecto</th>
                <th className="py-2 px-4 text-left font-semibold text-gray-800 whitespace-nowrap">Línea</th>
                {MESES_CORTOS.map((mc, i) => (
                  <th key={mc} className={mesHeaderCls(MESES_ABREV[i]).replace('#FFF5F0', '#F0F9FF')} title={MESES_NOMBRES[i]}>{mc}</th>
                ))}
                <th className="py-2 px-4 text-right font-semibold text-gray-800 whitespace-nowrap bg-blue-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {detalleFilasFiltradas.slice(paginaMonto * FILAS_POR_PAGINA, (paginaMonto + 1) * FILAS_POR_PAGINA).map((row, idx) => {
                const linea = proyectosLinea[normalize(row.proyecto)] || ''
                const rowTotal = MESES_ABREV.reduce((sum, m) => sum + montoFila(row, m), 0)
                return (
                  <tr key={`monto-${row.colaborador}|||${row.proyecto}`} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                    <td className="py-2 px-4 font-medium text-gray-700 whitespace-nowrap">{row.colaborador}</td>
                    <td className="py-2 px-4 text-gray-700 whitespace-nowrap">{row.proyecto}</td>
                    <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{linea || <span className="text-gray-300">—</span>}</td>
                    {MESES_ABREV.map(mes => {
                      const cubierto = mesesCubiertosAbrev.has(mes)
                      const monto = montoFila(row, mes)
                      return (
                        <td key={mes} className={`py-2 px-3 text-right tabular-nums ${cubierto ? 'bg-gray-100 text-gray-400' : monto === 0 ? 'text-gray-300' : 'text-gray-700'}`}>
                          {monto === 0 ? '—' : Math.round(monto).toLocaleString('es-CL')}
                        </td>
                      )
                    })}
                    <td className="py-2 px-4 text-right font-bold text-gray-800 bg-blue-50 tabular-nums">
                      {rowTotal === 0 ? '—' : Math.round(rowTotal).toLocaleString('es-CL')}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#F0F9FF' }}>
                <td colSpan={3} className="py-2 px-4 text-gray-800">TOTAL ({detalleFilasFiltradas.length})</td>
                {MESES_ABREV.map(mes => (
                  <td key={mes} className={`py-2 px-3 text-right tabular-nums text-gray-800 ${mesesCubiertosAbrev.has(mes) ? 'bg-gray-200' : ''}`}>
                    {montoTotalPorMes[mes] === 0 ? '—' : Math.round(montoTotalPorMes[mes]).toLocaleString('es-CL')}
                  </td>
                ))}
                <td className="py-2 px-4 text-right font-bold text-gray-800 bg-blue-100 tabular-nums">
                  {montoTotalGeneral === 0 ? '—' : Math.round(montoTotalGeneral).toLocaleString('es-CL')}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {detalleFilasFiltradas.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
          <span>{paginaMonto * FILAS_POR_PAGINA + 1}–{Math.min((paginaMonto + 1) * FILAS_POR_PAGINA, detalleFilasFiltradas.length)} de {detalleFilasFiltradas.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPaginaMonto(p => Math.max(0, p - 1))} disabled={paginaMonto === 0} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPaginaMonto(p => p + 1)} disabled={(paginaMonto + 1) * FILAS_POR_PAGINA >= detalleFilasFiltradas.length} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

    </div>
  )
}
