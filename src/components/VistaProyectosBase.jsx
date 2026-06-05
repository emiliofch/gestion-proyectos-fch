import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import ResizableTh from './ResizableTh'
import FilterableTh from './FilterableTh'
import { ESTADOS_PROYECTO, clasesBadgeEstadoProyecto, normalizarEstadoProyecto } from '../constants/estadosProyecto'
import { normalizarMesAdjudicacion } from '../constants/fechaAdjudicacion'

const TIPOS_PROYECTO = ['Público', 'Privado']
const ESTADOS_ADJUDICACION_EDITABLE = ['Efectivo', 'No Efectivo']
const COLUMNAS_OCULTAS_VISTA_OPORTUNIDADES = ['tipo', 'financista', 'region', 'industria', 'rendible', 'ceco', 'hp']
const REGIONES_CHILE = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo',
  'Valparaíso', 'Metropolitana', "O'Higgins", 'Maule', 'Ñuble',
  'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes',
]

function buildTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

function fmt(val) {
  const millones = (parseFloat(val) || 0) / 1_000_000
  return '$' + millones.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function puedeEditarFechaAdjudicacion(estado) {
  return ESTADOS_ADJUDICACION_EDITABLE.includes(normalizarEstadoProyecto(estado) || '')
}

function badgeRendible(rendible) {
  if (rendible === true)  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Sí</span>
  if (rendible === false) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">No</span>
  return <span className="text-gray-400 text-xs italic">-</span>
}

function badgeEstadoSelect(estado, proyecto, onSolicitar) {
  const estadoNormalizado = normalizarEstadoProyecto(estado)
  const colores = {
    'Efectivo':    'bg-green-100 text-green-800 border-green-300',
    'No Efectivo': 'bg-red-100 text-red-800 border-red-300',
    'Adjudicado':  'bg-blue-100 text-blue-800 border-blue-300',
    'Cancelado':   'bg-gray-200 text-gray-800 border-gray-400',
    'Meta':        'bg-purple-100 text-purple-800 border-purple-300',
  }
  const cls = colores[estadoNormalizado] || 'bg-gray-100 text-gray-600 border-gray-300'
  return (
    <select
      value={estadoNormalizado || ''}
      onChange={e => onSolicitar(proyecto, e.target.value)}
      className={`px-2 py-1 rounded-full text-xs font-medium border cursor-pointer focus:outline-none ${cls}`}
    >
      <option value="">Sin estado</option>
      {ESTADOS_PROYECTO.map(e => <option key={e} value={e}>{e}</option>)}
    </select>
  )
}

export default function VistaProyectosBase({ user, perfil }) {
  const esAdmin = perfil?.rol === 'admin'

  const [proyectos, setProyectos] = useState([])
  const [lineas, setLineas] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])
  const [financistas, setFinancistas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modoVista, setModoVista] = useState('proyectos')
  const [procesando, setProcesando] = useState(false)
  const [eliminandoTodos, setEliminandoTodos] = useState(false)
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false)
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('proyecto')
  const [ordenDir, setOrdenDir] = useState('asc')

  const [pagina, setPagina] = useState(0)
  const FILAS_POR_PAGINA = 10

  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [formData, setFormData] = useState({ nombre: '', ceco: '', estado: '', tipo: '', rendible: '', ceco_codigo: '', jefe_id: '', fecha_adjudicacion: '', industria: '', region: '', financista_id: '' })
  const [motivoCambio, setMotivoCambio] = useState('')
  const [costoPorProyecto, setCostoPorProyecto] = useState({}) // normalizado(nombre) → costo total HH
  const [proyEnHP, setProyEnHP] = useState(new Set())         // normalizado(nombre) en horas_proyectadas
  const [proyEnIngresoReal, setProyEnIngresoReal] = useState(new Set()) // normalizado(nombre) en ingreso_real_acumulado

  // Edición financiera (Ingresos / GGOO)
  const [modalEdicionFin, setModalEdicionFin] = useState(null) // { proyecto, campo }
  const [valorEditandoFin, setValorEditandoFin] = useState('')
  const [motivoCambioFin, setMotivoCambioFin] = useState('')

  // Cambio de estado con motivo
  const [modalMotivoEstado, setModalMotivoEstado] = useState(null) // { proyecto, nuevoEstado }
  const [motivoAccionEstado, setMotivoAccionEstado] = useState('')

  const [procesandoFin, setProcesandoFin] = useState(false)
  const esVistaOportunidades = modoVista === 'oportunidades'

  useEffect(() => {
    cargarLineas()
    cargarColaboradores()
    cargarCentrosCosto()
    cargarFinancistas()
    cargarProyectos()
    cargarCostosHorasProyectadas()
    cargarIngresoReal()
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  useEffect(() => { setPagina(0) }, [busqueda, filtros, ordenCol, ordenDir])

  useEffect(() => {
    if (!esVistaOportunidades) return

    setFiltros((prev) => {
      let huboCambios = false
      const next = { ...prev }

      for (const columna of COLUMNAS_OCULTAS_VISTA_OPORTUNIDADES) {
        if (columna in next) {
          delete next[columna]
          huboCambios = true
        }
      }

      return huboCambios ? next : prev
    })

    if (COLUMNAS_OCULTAS_VISTA_OPORTUNIDADES.includes(ordenCol)) {
      setOrdenCol('proyecto')
      setOrdenDir('asc')
    }
  }, [esVistaOportunidades, ordenCol])

  async function cargarLineas() {
    const { data, error } = await supabase
      .from('lineas')
      .select('linea')
      .order('linea', { ascending: true })

    if (error) {
      console.error('Error cargando lineas:', error)
      setLineas([])
      return
    }

    setLineas((data || []).map((l) => l.linea).filter(Boolean))
  }

  async function cargarColaboradores() {
    const { data } = await supabase
      .from('colaboradores')
      .select('id, colaborador')
      .order('colaborador', { ascending: true })
    setColaboradores(data || [])
  }

  async function cargarFinancistas() {
    const { data } = await supabase.from('financistas').select('id, nombre').order('nombre')
    setFinancistas(data || [])
  }

  async function cargarCentrosCosto() {
    const { data, error } = await supabase
      .from('centros_costo')
      .select('ceco')
      .order('ceco', { ascending: true })

    if (error) {
      console.error('Error cargando centros de costo:', error)
      setCentrosCosto([])
      return
    }

    setCentrosCosto((data || []).map((c) => c.ceco).filter(Boolean))
  }

  function normalizar(t) {
    return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  }

  async function cargarCostosHorasProyectadas() {
    const PAGE = 1000
    const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

    // Convierte "2026-04-01" → "abr-26" para comparar con hh_acumulado_real
    function mesAClave(mesStr) {
      if (!mesStr) return ''
      const d = new Date(mesStr.length === 7 ? mesStr + '-01' : mesStr)
      return MESES_ES[d.getUTCMonth()] + '-' + String(d.getUTCFullYear()).slice(2)
    }

    // Costos mensuales: { normalizar(colaborador) → { mes → costo_mes } }
    const costoMap = {}
    let cfrom = 0
    while (true) {
      const { data } = await supabase.from('colaboradores_costos').select('colaborador, mes, costo_mes').range(cfrom, cfrom + PAGE - 1)
      if (!data?.length) break
      for (const c of data) {
        const key = normalizar(c.colaborador)
        if (!costoMap[key]) costoMap[key] = {}
        costoMap[key][c.mes] = parseFloat(c.costo_mes) || 0
      }
      if (data.length < PAGE) break
      cfrom += PAGE
    }

    let todas = [], from = 0
    while (true) {
      const { data } = await supabase
        .from('horas_proyectadas')
        .select('proyecto, horas, colaborador, mes')
        .range(from, from + PAGE - 1)
      if (!data?.length) break
      todas = [...todas, ...data]
      if (data.length < PAGE) break
      from += PAGE
    }

    // Cargar datos reales: { "proyecto_key|mes" → monto_real }
    // y set de pares cubiertos para no sumar el proyectado en esos períodos
    const { data: reales } = await supabase.from('hh_acumulado_real').select('nombre_proyecto, mes, monto_hh_real')
    const costosReales = {}   // pKey → suma monto real
    const cubiertos = new Set() // "pKey|mes" pares con data real
    for (const r of reales || []) {
      const pKey = normalizar(r.nombre_proyecto)
      if (!pKey) continue
      const mesKey = `${pKey}|${r.mes}`
      cubiertos.add(mesKey)
      costosReales[pKey] = (costosReales[pKey] || 0) + (parseFloat(r.monto_hh_real) || 0)
    }

    // Proyectado solo para pares (proyecto, mes) no cubiertos por real
    const costos = {}
    const enHP = new Set()
    for (const f of todas) {
      const pKey = normalizar(f.proyecto)
      if (pKey) enHP.add(pKey)
      const mesKey = `${pKey}|${mesAClave(f.mes)}`
      if (cubiertos.has(mesKey)) continue // ya lo cubre el real
      const costo = (parseFloat(f.horas) || 0) * (costoMap[normalizar(f.colaborador)]?.[f.mes] || 0)
      costos[pKey] = (costos[pKey] || 0) + costo
    }

    // Final: proyectado (no cubierto) + real
    for (const [pKey, monto] of Object.entries(costosReales)) {
      costos[pKey] = (costos[pKey] || 0) + monto
    }

    setCostoPorProyecto(costos)
    setProyEnHP(enHP)
  }

  async function cargarIngresoReal() {
    const { data } = await supabase.from('ingreso_real_acumulado').select('nombre')
    const enIR = new Set((data || []).map(r => normalizar(r.nombre)).filter(Boolean))
    setProyEnIngresoReal(enIR)
  }

  async function cargarProyectos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('proyectos')
      .select('*, colaboradores:jefe_id(id, colaborador), financistas:financista_id(id, nombre)')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error cargando proyectos:', error)
    } else {
      setProyectos(data || [])
    }
    setLoading(false)
  }

  function parseRendible(val) {
    if (val === 'true')  return true
    if (val === 'false') return false
    return null
  }

  function rendibleToString(val) {
    if (val === true)  return 'true'
    if (val === false) return 'false'
    return ''
  }

  // IMPORTAR PROYECTOS DESDE EXCEL
  async function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return

    setProcesando(true)
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet)

        let insertados = 0
        let errores = 0
        let duplicados = []

        for (let i = 0; i < data.length; i++) {
          const row = data[i]

          const nombre      = row.PROYECTO  || row.proyecto  || row.NOMBRE   || row.nombre   || ''
          const ceco        = row.LINEA     || row.linea     || row['CENTRO DE COSTO'] || ''
          const estadoRaw   = row.ESTADO    || row.estado    || ''
          const estado      = normalizarEstadoProyecto(estadoRaw)
          const tipo        = row.TIPO      || row.tipo      || ''
          const rendStr     = row.RENDIBLE  || row.rendible  || ''
          const ceco_codigo = row.CECO      || row.ceco      || ''
          const jefeNombre  = row.JEFE      || row.jefe      || ''

          if (!nombre.trim() || !ceco.trim()) {
            errores++
            continue
          }

          let rendible = null
          const r = rendStr.toString().toLowerCase().trim()
          if (r === 'si' || r === 'sí' || r === 'yes' || r === 'true' || r === '1') rendible = true
          else if (r === 'no' || r === 'false' || r === '0') rendible = false

          // Buscar jefe_id por nombre si viene en el Excel
          let jefe_id = null
          if (jefeNombre.trim()) {
            const match = colaboradores.find(
              c => c.colaborador.toLowerCase() === jefeNombre.trim().toLowerCase()
            )
            jefe_id = match?.id || null
          }

          const { data: existente } = await supabase
            .from('proyectos')
            .select('id')
            .eq('nombre', nombre.trim())
            .limit(1)

          if (existente && existente.length > 0) {
            duplicados.push(nombre)
            continue
          }

          const { data: nuevoProyecto, error: errorInsert } = await supabase
            .from('proyectos')
            .insert({
              nombre:      nombre.trim(),
              ceco:        ceco.trim(),
              estado,
              tipo:        tipo.trim()        || null,
              rendible,
              ceco_codigo: ceco_codigo.trim() || null,
              jefe_id
            })
            .select()
            .single()

          if (errorInsert) {
            console.error('Error insert:', errorInsert)
            errores++
          } else {
            insertados++
            await supabase.from('cambios').insert({
              proyecto_id:     nuevoProyecto.id,
              campo:           'PROYECTO CREADO',
              valor_anterior:  '',
              valor_nuevo:     nombre.trim(),
              usuario:         user?.email || 'sistema',
              motivo:          'Proyecto importado desde Excel',
              tipo_cambio:     'proyecto',
              proyecto_nombre: nombre.trim()
            })
          }
        }

        if (duplicados.length > 0) toast.warning(`${duplicados.length} proyectos ya existían`)
        if (errores > 0) toast.warning(`${errores} filas ignoradas (faltan campos requeridos)`)
        toast.success(`Importación: ${insertados} proyectos creados`)
        cargarProyectos()
      } catch (error) {
        console.error('Error:', error)
        toast.error('Error: ' + error.message)
      }
      setProcesando(false)
    }

    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  function exportarExcel() {
    const filas = proyectosFiltrados.map((p, i) => {
      const hh     = costoPorProyecto[normalizar(p.nombre)] || 0
      const ing    = parseFloat(p.ingresos) || 0
      const gastos = parseFloat(p.gastos)   || 0
      const margen = ing - hh - gastos
      return {
        '#':        i + 1,
        LINEA:      p.ceco || '',
        PROYECTO:   p.nombre,
        JEFE:       p.colaboradores?.colaborador || '',
        INGRESOS:   ing,
        HH:         Math.round(hh),
        GGOO:       gastos,
        MARGEN:     Math.round(margen),
        ESTADO:      normalizarEstadoProyecto(p.estado) || '',
        TIPO:        p.tipo || '',
        FINANCISTA:  p.financistas?.nombre || '',
        REGION:      p.region || '',
        INDUSTRIA:   p.industria || '',
        RENDIBLE:    p.rendible === true ? 'Sí' : p.rendible === false ? 'No' : '',
        CECO:        p.ceco_codigo || '',
        FECHA_ADJ:   p.fecha_adjudicacion || '',
        EN_HP:       proyEnHP.has(normalizar(p.nombre)) ? 'Sí' : 'No',
      }
    })
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Proyectos')
    XLSX.writeFile(wb, `proyectos_${buildTimestamp()}.xlsx`)
  }

  function generarReporte() {
    const COL_WIDTHS = [
      { wch: 4 }, { wch: 22 }, { wch: 32 }, { wch: 22 },
      { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 },
      { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 20 },
      { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 8 },
    ]

    function toFila(p, i) {
      const hh     = costoPorProyecto[normalizar(p.nombre)] || 0
      const ing    = parseFloat(p.ingresos) || 0
      const gastos = parseFloat(p.gastos)   || 0
      return {
        '#':        i + 1,
        LINEA:      p.ceco || '',
        PROYECTO:   p.nombre,
        JEFE:       p.colaboradores?.colaborador || '',
        INGRESOS:   ing,
        HH:         Math.round(hh),
        GGOO:       gastos,
        MARGEN:     Math.round(ing - hh - gastos),
        ESTADO:     normalizarEstadoProyecto(p.estado) || '',
        TIPO:       p.tipo || '',
        FINANCISTA: p.financistas?.nombre || '',
        REGION:     p.region || '',
        INDUSTRIA:  p.industria || '',
        RENDIBLE:   p.rendible === true ? 'Sí' : p.rendible === false ? 'No' : '',
        CECO:       p.ceco_codigo || '',
        FECHA_ADJ:  p.fecha_adjudicacion || '',
        EN_HP:      proyEnHP.has(normalizar(p.nombre)) ? 'Sí' : 'No',
      }
    }

    function toTotal(lista) {
      const totIng    = lista.reduce((s, p) => s + (parseFloat(p.ingresos) || 0), 0)
      const totHH     = lista.reduce((s, p) => s + (costoPorProyecto[normalizar(p.nombre)] || 0), 0)
      const totGastos = lista.reduce((s, p) => s + (parseFloat(p.gastos) || 0), 0)
      return {
        '#': '', LINEA: '', PROYECTO: `TOTAL (${lista.length})`, JEFE: '',
        INGRESOS: totIng, HH: Math.round(totHH), GGOO: totGastos,
        MARGEN: Math.round(totIng - totHH - totGastos),
        ESTADO: '', TIPO: '', FINANCISTA: '', REGION: '', INDUSTRIA: '',
        RENDIBLE: '', CECO: '', FECHA_ADJ: '', EN_HP: '',
      }
    }

    function construirHoja(lista) {
      const filas = lista.map((p, i) => toFila(p, i))
      filas.push(toTotal(lista))
      const ws = XLSX.utils.json_to_sheet(filas)
      ws['!cols'] = COL_WIDTHS
      return ws
    }

    const wb = XLSX.utils.book_new()

    // Hoja 1: todos los proyectos filtrados
    XLSX.utils.book_append_sheet(wb, construirHoja(proyectosFiltrados), 'Todos')

    // Una hoja por jefe, ordenadas alfabéticamente
    const porJefe = {}
    for (const p of proyectosFiltrados) {
      const jefe = p.colaboradores?.colaborador || 'Sin Jefe'
      if (!porJefe[jefe]) porJefe[jefe] = []
      porJefe[jefe].push(p)
    }

    const nombresHojas = new Set(['Todos'])
    for (const jefe of Object.keys(porJefe).sort((a, b) => a.localeCompare(b, 'es'))) {
      let nombre = jefe.replace(/[\\\/\*\?\:\[\]]/g, '').slice(0, 31)
      let sufijo = 2
      while (nombresHojas.has(nombre)) { nombre = nombre.slice(0, 28) + `_${sufijo++}` }
      nombresHojas.add(nombre)
      XLSX.utils.book_append_sheet(wb, construirHoja(porJefe[jefe]), nombre)
    }

    XLSX.writeFile(wb, `reporte_proyectos_${buildTimestamp()}.xlsx`)
  }

  async function eliminarTodos() {
    const confirm1 = window.confirm(
      `¿Eliminar TODOS los ${proyectos.length} proyectos?\n\nEsta acción no se puede deshacer.`
    )
    if (!confirm1) return
    const confirm2 = window.confirm('Confirmación final: ¿Estás seguro? Se eliminarán TODOS los proyectos.')
    if (!confirm2) return

    setEliminandoTodos(true)
    const { error } = await supabase.from('proyectos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      toast.error('Error al eliminar: ' + error.message)
    } else {
      toast.success('Todos los proyectos han sido eliminados')
      cargarProyectos()
    }
    setEliminandoTodos(false)
  }

  function abrirModalCrear() {
    setFormData({ nombre: '', ceco: '', estado: '', tipo: '', rendible: '', ceco_codigo: '', jefe_id: '', fecha_adjudicacion: '', industria: '', region: '', financista_id: '' })
    setModalCrear(true)
  }

  function validarFormularioProyecto() {
    if (!formData.nombre.trim()) return 'El nombre del proyecto es requerido'
    if (!formData.ceco.trim()) return 'Debes seleccionar una línea'
    if (!formData.jefe_id) return 'Debes seleccionar un jefe de proyecto'
    if (!normalizarEstadoProyecto(formData.estado)) return 'Debes seleccionar un estado válido'
    if (!TIPOS_PROYECTO.includes(formData.tipo)) return 'Debes seleccionar un tipo (Público o Privado)'
    if (!['true', 'false'].includes(formData.rendible)) return 'Debes seleccionar si es rendible'
    if (!formData.ceco_codigo.trim()) return 'Debes seleccionar un CECO'

    const fechaAdjudicacion = normalizarMesAdjudicacion(formData.fecha_adjudicacion)
    if (fechaAdjudicacion === undefined) return 'Fecha de adjudicación inválida. Usa formato "ene-26"'
    const estadoActual = normalizarEstadoProyecto(formData.estado)
    const fechaOpcional = estadoActual === 'Adjudicado' || estadoActual === 'Cancelado' || estadoActual === 'Meta'
    if (!fechaOpcional && !fechaAdjudicacion) {
      return 'Debes seleccionar fecha de adjudicación cuando el estado no es "Adjudicado", "Cancelado" ni "Meta"'
    }
    return null
  }

  async function crearProyecto() {
    const errorValidacion = validarFormularioProyecto()
    if (errorValidacion) { toast.error(errorValidacion); return }

    const { data: nuevoProyecto, error } = await supabase
      .from('proyectos')
      .insert({
        nombre:      formData.nombre.trim(),
        ceco:        formData.ceco.trim(),
        estado:      normalizarEstadoProyecto(formData.estado),
        tipo:        formData.tipo.trim(),
        rendible:    parseRendible(formData.rendible),
        ceco_codigo: formData.ceco_codigo.trim(),
        jefe_id:       formData.jefe_id,
        fecha_adjudicacion: normalizarMesAdjudicacion(formData.fecha_adjudicacion),
        industria:     formData.industria.trim()   || null,
        region:        formData.region             || null,
        financista_id: formData.financista_id      || null,
      })
      .select()
      .single()

    if (error) { toast.error('Error al crear proyecto: ' + error.message); return }

    await supabase.from('cambios').insert({
      proyecto_id:     nuevoProyecto.id,
      campo:           'PROYECTO CREADO',
      valor_anterior:  '',
      valor_nuevo:     formData.nombre.trim(),
      usuario:         user?.email || 'sistema',
      motivo:          'Proyecto creado manualmente',
      tipo_cambio:     'proyecto',
      proyecto_nombre: formData.nombre.trim()
    })

    toast.success('Proyecto creado')
    setModalCrear(false)
    cargarProyectos()
  }

  function abrirModalEditar(proyecto) {
    setFormData({
      nombre:      proyecto.nombre,
      ceco:        proyecto.ceco,
      estado:      normalizarEstadoProyecto(proyecto.estado) || '',
      tipo:        proyecto.tipo         || '',
      rendible:    rendibleToString(proyecto.rendible),
      ceco_codigo:   proyecto.ceco_codigo   || '',
      jefe_id:       proyecto.jefe_id       || '',
      fecha_adjudicacion: proyecto.fecha_adjudicacion || '',
      industria:     proyecto.industria     || '',
      region:        proyecto.region        || '',
      financista_id: proyecto.financista_id || '',
    })
    setMotivoCambio('')
    setModalEditar(proyecto)
  }

  async function guardarEdicion() {
    if (!modalEditar) return
    const errorValidacion = validarFormularioProyecto()
    if (errorValidacion) { toast.error(errorValidacion); return }
    if (!motivoCambio.trim())    { toast.error('Debes ingresar un motivo para el cambio'); return }

    const cambiosList = []

    if (modalEditar.nombre !== formData.nombre.trim())
      cambiosList.push({ campo: 'NOMBRE',   anterior: modalEditar.nombre,           nuevo: formData.nombre.trim() })
    if (modalEditar.ceco !== formData.ceco.trim())
      cambiosList.push({ campo: 'LINEA',    anterior: modalEditar.ceco,             nuevo: formData.ceco.trim() })
    const estadoNuevo = normalizarEstadoProyecto(formData.estado) || ''
    const estadoAnterior = normalizarEstadoProyecto(modalEditar.estado) || ''
    if (estadoAnterior !== estadoNuevo)
      cambiosList.push({ campo: 'ESTADO',   anterior: estadoAnterior, nuevo: estadoNuevo })
    if ((modalEditar.tipo || '') !== formData.tipo)
      cambiosList.push({ campo: 'TIPO',     anterior: modalEditar.tipo || '',       nuevo: formData.tipo })
    if (rendibleToString(modalEditar.rendible) !== formData.rendible)
      cambiosList.push({ campo: 'RENDIBLE', anterior: rendibleToString(modalEditar.rendible), nuevo: formData.rendible })
    if ((modalEditar.ceco_codigo || '') !== formData.ceco_codigo.trim())
      cambiosList.push({ campo: 'CECO',     anterior: modalEditar.ceco_codigo || '', nuevo: formData.ceco_codigo.trim() })
    if ((modalEditar.fecha_adjudicacion || '') !== (normalizarMesAdjudicacion(formData.fecha_adjudicacion) || ''))
      cambiosList.push({ campo: 'FECHA_ADJUDICACION', anterior: modalEditar.fecha_adjudicacion || '', nuevo: normalizarMesAdjudicacion(formData.fecha_adjudicacion) || '' })
    if ((modalEditar.jefe_id || '') !== (formData.jefe_id || '')) {
      const anterior = colaboradores.find(c => c.id === modalEditar.jefe_id)?.colaborador || '-'
      const nuevo    = colaboradores.find(c => c.id === formData.jefe_id)?.colaborador    || '-'
      cambiosList.push({ campo: 'JEFE', anterior, nuevo })
    }
    if ((modalEditar.industria || '') !== formData.industria.trim())
      cambiosList.push({ campo: 'INDUSTRIA', anterior: modalEditar.industria || '', nuevo: formData.industria.trim() })
    if ((modalEditar.region || '') !== formData.region)
      cambiosList.push({ campo: 'REGION', anterior: modalEditar.region || '', nuevo: formData.region })
    if ((modalEditar.financista_id || '') !== (formData.financista_id || '')) {
      const anterior = financistas.find(f => f.id === modalEditar.financista_id)?.nombre || '-'
      const nuevo    = financistas.find(f => f.id === formData.financista_id)?.nombre    || '-'
      cambiosList.push({ campo: 'FINANCISTA', anterior, nuevo })
    }

    if (cambiosList.length === 0) {
      toast.info('No hay cambios para guardar')
      setModalEditar(null)
      return
    }

    const { error } = await supabase
      .from('proyectos')
      .update({
        nombre:      formData.nombre.trim(),
        ceco:        formData.ceco.trim(),
        estado:      normalizarEstadoProyecto(formData.estado),
        tipo:        formData.tipo,
        rendible:    parseRendible(formData.rendible),
        ceco_codigo: formData.ceco_codigo.trim(),
        jefe_id:       formData.jefe_id,
        fecha_adjudicacion: normalizarMesAdjudicacion(formData.fecha_adjudicacion),
        industria:     formData.industria.trim()   || null,
        region:        formData.region             || null,
        financista_id: formData.financista_id      || null,
      })
      .eq('id', modalEditar.id)

    if (error) { toast.error('Error al actualizar: ' + error.message); return }

    for (const c of cambiosList) {
      await supabase.from('cambios').insert({
        proyecto_id:     modalEditar.id,
        campo:           c.campo,
        valor_anterior:  c.anterior,
        valor_nuevo:     c.nuevo,
        usuario:         user?.email || 'sistema',
        motivo:          motivoCambio,
        tipo_cambio:     'proyecto',
        proyecto_nombre: formData.nombre.trim()
      })
    }

    toast.success('Proyecto actualizado')
    setModalEditar(null)
    cargarProyectos()
  }

  async function eliminarProyecto(proyecto) {
    if (proyEnHP.has(normalizar(proyecto.nombre))) {
      toast.error(`No se puede eliminar "${proyecto.nombre}" porque tiene horas proyectadas cargadas.`)
      return
    }
    if (proyEnIngresoReal.has(normalizar(proyecto.nombre))) {
      toast.error(`No se puede eliminar "${proyecto.nombre}" porque tiene datos en Ingreso Real Acumulado.`)
      return
    }
    if (!confirm(`¿Eliminar el proyecto "${proyecto.nombre}"?`)) return

    await supabase.from('cambios').insert({
      proyecto_id:     proyecto.id,
      campo:           'PROYECTO ELIMINADO',
      valor_anterior:  proyecto.nombre,
      valor_nuevo:     '',
      usuario:         user?.email || 'sistema',
      motivo:          'Proyecto eliminado manualmente',
      tipo_cambio:     'proyecto',
      proyecto_nombre: proyecto.nombre
    })

    const { error } = await supabase.from('proyectos').delete().eq('id', proyecto.id)
    if (error) {
      toast.error('Error al eliminar: ' + error.message)
    } else {
      toast.success('Proyecto eliminado')
      cargarProyectos()
    }
  }

  // ── EDICIÓN FINANCIERA (Ingresos / GGOO) ──
  function abrirModalEdicionFin(proyecto, campo) {
    setModalEdicionFin({ proyecto, campo })
    setValorEditandoFin((proyecto[campo] ?? 0).toString())
    setMotivoCambioFin('')
  }

  async function guardarEdicionFin() {
    if (!modalEdicionFin) return
    const { proyecto, campo } = modalEdicionFin
    const valorAnterior = parseFloat(proyecto[campo]) || 0
    const valorNuevo = parseFloat(valorEditandoFin) || 0
    if (valorAnterior === valorNuevo) { setModalEdicionFin(null); return }
    if (!motivoCambioFin.trim()) { toast.error('Debes ingresar un motivo'); return }

    setProcesandoFin(true)
    const { error } = await supabase.from('proyectos').update({ [campo]: valorNuevo }).eq('id', proyecto.id)
    if (error) { toast.error('Error: ' + error.message); setProcesandoFin(false); return }

    await supabase.from('cambios').insert({
      proyecto_id:     proyecto.id,
      campo:           campo === 'gastos' ? 'GGOO' : campo.toUpperCase(),
      valor_anterior:  valorAnterior.toString(),
      valor_nuevo:     valorNuevo.toString(),
      usuario:         user?.email || 'sistema',
      motivo:          motivoCambioFin,
      tipo_cambio:     'valor',
      proyecto_nombre: proyecto.nombre
    })

    toast.success('Valor actualizado')
    setModalEdicionFin(null)
    setProcesandoFin(false)
    cargarProyectos()
  }

  // ── CAMBIO DE ESTADO CON MOTIVO ──
  function solicitarCambioEstado(proyecto, nuevoEstado) {
    setModalMotivoEstado({ proyecto, nuevoEstado })
    setMotivoAccionEstado('')
  }

  async function confirmarCambioEstado() {
    if (!modalMotivoEstado) return
    if (!motivoAccionEstado.trim()) { toast.error('Debes ingresar un motivo'); return }
    const { proyecto, nuevoEstado } = modalMotivoEstado
    const estadoAnterior = normalizarEstadoProyecto(proyecto.estado) || ''

    const { error } = await supabase.from('proyectos').update({ estado: nuevoEstado || null }).eq('id', proyecto.id)
    if (error) { toast.error('Error: ' + error.message); return }

    await supabase.from('cambios').insert({
      proyecto_id:     proyecto.id,
      campo:           'ESTADO',
      valor_anterior:  estadoAnterior,
      valor_nuevo:     nuevoEstado || '',
      usuario:         user?.email || 'sistema',
      motivo:          motivoAccionEstado,
      tipo_cambio:     'proyecto',
      proyecto_nombre: proyecto.nombre
    })

    toast.success('Estado actualizado')
    setModalMotivoEstado(null)
    setMotivoAccionEstado('')
    cargarProyectos()
  }

  // ── JEFE INLINE ──
  async function guardarJefe(proyecto, nuevoJefeId) {
    const anteriorId = proyecto.jefe_id || null
    const nuevoId = nuevoJefeId || null
    if (anteriorId === nuevoId) return
    const anteriorNombre = colaboradores.find(c => c.id === anteriorId)?.colaborador || '-'
    const nuevoNombre    = colaboradores.find(c => c.id === nuevoId)?.colaborador    || '-'
    const { error } = await supabase.from('proyectos').update({ jefe_id: nuevoId }).eq('id', proyecto.id)
    if (error) { toast.error('Error al actualizar jefe: ' + error.message); return }
    await supabase.from('cambios').insert({
      proyecto_id:     proyecto.id,
      campo:           'JEFE',
      valor_anterior:  anteriorNombre,
      valor_nuevo:     nuevoNombre,
      usuario:         user?.email || 'sistema',
      motivo:          'Cambio directo desde tabla',
      tipo_cambio:     'proyecto',
      proyecto_nombre: proyecto.nombre,
    })
    const nuevoColab = nuevoId ? colaboradores.find(c => c.id === nuevoId) || null : null
    setProyectos(prev => prev.map(p =>
      p.id === proyecto.id ? { ...p, jefe_id: nuevoId, colaboradores: nuevoColab } : p
    ))
    toast.success('Jefe actualizado')
  }

  // ── FECHA ADJUDICACIÓN INLINE ──
  async function guardarComentario(proyecto, valor) {
    const comentario = valor.trim() || null
    if (comentario === (proyecto.comentarios || null)) return
    const { error } = await supabase.from('proyectos').update({ comentarios: comentario }).eq('id', proyecto.id)
    if (error) { toast.error('Error al guardar comentario: ' + error.message); return }
    setProyectos(prev => prev.map(p => p.id === proyecto.id ? { ...p, comentarios: comentario } : p))
  }

  async function actualizarFechaAdjudicacion(proyecto, valor, onInvalid) {
    if (!puedeEditarFechaAdjudicacion(proyecto.estado)) {
      toast.error('Fecha de adjudicación solo editable para estado Efectivo o No Efectivo')
      onInvalid?.(proyecto.fecha_adjudicacion || '')
      return
    }
    const normalizado = normalizarMesAdjudicacion(valor)
    if (normalizado === undefined) {
      toast.error('Formato inválido. Usa "ene-26"')
      onInvalid?.(proyecto.fecha_adjudicacion || '')
      return
    }
    if (normalizado === (proyecto.fecha_adjudicacion || null)) return
    const { error } = await supabase.from('proyectos').update({ fecha_adjudicacion: normalizado }).eq('id', proyecto.id)
    if (error) { toast.error('Error: ' + error.message); onInvalid?.(proyecto.fecha_adjudicacion || ''); return }
    setProyectos(prev => prev.map(p => p.id === proyecto.id ? { ...p, fecha_adjudicacion: normalizado } : p))
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

  const proyectosBusqueda = proyectos.filter(p => {
    const q = busqueda.toLowerCase()
    return (
      p.nombre?.toLowerCase().includes(q) ||
      p.ceco?.toLowerCase().includes(q) ||
      (normalizarEstadoProyecto(p.estado) || '').toLowerCase().includes(q) ||
      p.tipo?.toLowerCase().includes(q) ||
      p.colaboradores?.colaborador?.toLowerCase().includes(q)
    )
  })

  function coincideFiltros(p, omitirCol = null) {
    const rendibleTxt = p.rendible === true ? 'Sí' : p.rendible === false ? 'No' : ''
    const hh = costoPorProyecto[normalizar(p.nombre)] || 0
    const ing = parseFloat(p.ingresos) || 0
    const gastos = parseFloat(p.gastos) || 0
    const margen = ing - hh - gastos
    const tieneFinanciero = ing > 0 || hh > 0 || gastos > 0
    const fmtIng = ing > 0 ? fmt(ing) : ''
    const fmtHH = hh > 0 ? fmt(hh) : ''
    const fmtGastos = gastos > 0 ? fmt(gastos) : ''
    const fmtMargen = tieneFinanciero ? fmt(margen) : ''
    const hpTxt = proyEnHP.has(normalizar(p.nombre)) ? 'Sí' : 'No'
    const matchLinea = omitirCol === 'linea' || !filtros.linea?.length || filtros.linea.includes(p.ceco)
    const matchProyecto = omitirCol === 'proyecto' || !filtros.proyecto?.length || filtros.proyecto.includes(p.nombre)
    const matchJefe = omitirCol === 'jefe' || !filtros.jefe?.length || filtros.jefe.includes(p.colaboradores?.colaborador)
    const estadoNormalizado = normalizarEstadoProyecto(p.estado)
    const matchEstado = omitirCol === 'estado' || !filtros.estado?.length || filtros.estado.includes(estadoNormalizado)
    const matchTipo = omitirCol === 'tipo' || !filtros.tipo?.length || filtros.tipo.includes(p.tipo)
    const matchFinancista = omitirCol === 'financista' || !filtros.financista?.length || filtros.financista.includes(p.financistas?.nombre)
    const matchRegion = omitirCol === 'region' || !filtros.region?.length || filtros.region.includes(p.region)
    const matchIndustria = omitirCol === 'industria' || !filtros.industria?.length || filtros.industria.includes(p.industria)
    const matchRendible = omitirCol === 'rendible' || !filtros.rendible?.length || filtros.rendible.includes(rendibleTxt)
    const matchCeco = omitirCol === 'ceco' || !filtros.ceco?.length || filtros.ceco.includes(p.ceco_codigo)
    const matchIngresos = omitirCol === 'ingresos' || !filtros.ingresos?.length || filtros.ingresos.includes(fmtIng)
    const matchHH = omitirCol === 'hh' || !filtros.hh?.length || filtros.hh.includes(fmtHH)
    const matchGastos = omitirCol === 'gastos' || !filtros.gastos?.length || filtros.gastos.includes(fmtGastos)
    const matchMargen = omitirCol === 'margen' || !filtros.margen?.length || filtros.margen.includes(fmtMargen)
    const matchHP = omitirCol === 'hp' || !filtros.hp?.length || filtros.hp.includes(hpTxt)
    const matchFechaAdj = omitirCol === 'fechaAdj' || !filtros.fechaAdj?.length || filtros.fechaAdj.includes(p.fecha_adjudicacion || '')
    return matchLinea && matchProyecto && matchJefe && matchEstado && matchTipo && matchFinancista && matchRegion && matchIndustria && matchRendible && matchCeco && matchIngresos && matchHH && matchGastos && matchMargen && matchHP && matchFechaAdj
  }

  function opcionesPorColumna(col, obtenerValor) {
    const visibles = proyectosBusqueda.filter((p) => coincideFiltros(p, col))
    const base = visibles.map(obtenerValor).filter(Boolean)
    const seleccionadas = Array.isArray(filtros[col]) ? filtros[col] : []
    return [...new Set([...base, ...seleccionadas])].sort((a, b) => String(a).localeCompare(String(b), 'es'))
  }

  const opcionesLinea = opcionesPorColumna('linea', (p) => p.ceco)
  const opcionesProyecto = opcionesPorColumna('proyecto', (p) => p.nombre)
  const opcionesJefe = opcionesPorColumna('jefe', (p) => p.colaboradores?.colaborador)
  const opcionesEstado = opcionesPorColumna('estado', (p) => normalizarEstadoProyecto(p.estado))
  const opcionesTipo = opcionesPorColumna('tipo', (p) => p.tipo)
  const opcionesRendible = opcionesPorColumna(
    'rendible',
    (p) => (p.rendible === true ? 'Sí' : p.rendible === false ? 'No' : ''),
  )
  const opcionesCeco = opcionesPorColumna('ceco', p => p.ceco_codigo)
  const opcionesIngresos = opcionesPorColumna('ingresos', p => (parseFloat(p.ingresos) || 0) > 0 ? fmt(parseFloat(p.ingresos)) : null)
  const opcionesHH = opcionesPorColumna('hh', p => { const h = costoPorProyecto[normalizar(p.nombre)] || 0; return h > 0 ? fmt(h) : null })
  const opcionesGastos = opcionesPorColumna('gastos', p => (parseFloat(p.gastos) || 0) > 0 ? fmt(parseFloat(p.gastos)) : null)
  const opcionesMargen = opcionesPorColumna('margen', p => {
    const h = costoPorProyecto[normalizar(p.nombre)] || 0
    const ing = parseFloat(p.ingresos) || 0
    const gastos = parseFloat(p.gastos) || 0
    return (ing > 0 || h > 0 || gastos > 0) ? fmt(ing - h - gastos) : null
  })
  const opcionesFechaAdj = opcionesPorColumna('fechaAdj', p => p.fecha_adjudicacion || null)

  const proyectosFiltrados = proyectosBusqueda.filter((p) => coincideFiltros(p)).sort((a, b) => {
    let vA = ''
    let vB = ''
    if (ordenCol === 'linea') { vA = a.ceco || ''; vB = b.ceco || '' }
    if (ordenCol === 'proyecto') { vA = a.nombre || ''; vB = b.nombre || '' }
    if (ordenCol === 'jefe') { vA = a.colaboradores?.colaborador || ''; vB = b.colaboradores?.colaborador || '' }
    if (ordenCol === 'estado') { vA = normalizarEstadoProyecto(a.estado) || ''; vB = normalizarEstadoProyecto(b.estado) || '' }
    if (ordenCol === 'tipo') { vA = a.tipo || ''; vB = b.tipo || '' }
    if (ordenCol === 'financista') { vA = a.financistas?.nombre || ''; vB = b.financistas?.nombre || '' }
    if (ordenCol === 'region') { vA = a.region || ''; vB = b.region || '' }
    if (ordenCol === 'industria') { vA = a.industria || ''; vB = b.industria || '' }
    if (ordenCol === 'rendible') { vA = a.rendible === true ? 1 : a.rendible === false ? 0 : -1; vB = b.rendible === true ? 1 : b.rendible === false ? 0 : -1 }
    if (ordenCol === 'ceco') { vA = a.ceco_codigo || ''; vB = b.ceco_codigo || '' }
    if (ordenCol === 'hp') { vA = proyEnHP.has(normalizar(a.nombre)) ? 1 : 0; vB = proyEnHP.has(normalizar(b.nombre)) ? 1 : 0 }
    if (ordenCol === 'fechaAdj') { vA = a.fecha_adjudicacion || ''; vB = b.fecha_adjudicacion || '' }
    if (ordenCol === 'ingresos') { vA = parseFloat(a.ingresos) || 0; vB = parseFloat(b.ingresos) || 0 }
    if (ordenCol === 'gastos')   { vA = parseFloat(a.gastos)   || 0; vB = parseFloat(b.gastos)   || 0 }
    if (ordenCol === 'hh') { vA = costoPorProyecto[normalizar(a.nombre)] || 0; vB = costoPorProyecto[normalizar(b.nombre)] || 0 }
    if (ordenCol === 'margen') {
      const hhA = costoPorProyecto[normalizar(a.nombre)] || 0
      const hhB = costoPorProyecto[normalizar(b.nombre)] || 0
      vA = (parseFloat(a.ingresos) || 0) - hhA - (parseFloat(a.gastos) || 0)
      vB = (parseFloat(b.ingresos) || 0) - hhB - (parseFloat(b.gastos) || 0)
    }
    if (typeof vA === 'string') return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
    return ordenDir === 'asc' ? vA - vB : vB - vA
  })

  const proyectosPagina = proyectosFiltrados.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA)
  const columnasOcultasCount = esVistaOportunidades ? COLUMNAS_OCULTAS_VISTA_OPORTUNIDADES.length : 0

  // Campo select reutilizable para jefe
  function SelectJefe({ value, onChange }) {
    return (
      <select
        value={value}
        onChange={onChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        <option value="">Sin asignar</option>
        {colaboradores.map(c => (
          <option key={c.id} value={c.id}>{c.colaborador}</option>
        ))}
      </select>
    )
  }

  function SelectLinea({ value, onChange }) {
    const opciones = [...new Set([...(lineas || []), value].filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'es'))

    return (
      <select
        value={value}
        onChange={onChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        <option value="">Seleccionar línea...</option>
        {opciones.map((ceco) => (
          <option key={ceco} value={ceco}>{ceco}</option>
        ))}
      </select>
    )
  }

  function SelectFinancista({ value, onChange }) {
    return (
      <select value={value} onChange={onChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
        <option value="">Sin financista</option>
        {financistas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
      </select>
    )
  }

  function SelectRegion({ value, onChange }) {
    return (
      <select value={value} onChange={onChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
        <option value="">Sin región</option>
        {REGIONES_CHILE.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    )
  }

  function SelectCeco({ value, onChange }) {
    const opciones = [...new Set([...(centrosCosto || []), value].filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'es'))

    return (
      <select
        value={value}
        onChange={onChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        <option value="">Sin definir</option>
        {opciones.map((ceco) => (
          <option key={ceco} value={ceco}>{ceco}</option>
        ))}
      </select>
    )
  }

  return (
    <div>
      {/* Cabecera */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Proyectos</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            type="button"
            onClick={() => setModoVista('proyectos')}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: esVistaOportunidades ? '#E5E7EB' : '#FF5100',
              color: esVistaOportunidades ? '#374151' : '#FFFFFF'
            }}
          >
            Vista proyectos
          </button>
          <button
            type="button"
            onClick={() => setModoVista('oportunidades')}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: esVistaOportunidades ? '#0EA5E9' : '#E5E7EB',
              color: esVistaOportunidades ? '#FFFFFF' : '#374151'
            }}
          >
            vista oportunidades
          </button>
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={() => setMostrarInstrucciones(!mostrarInstrucciones)}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all"
            title="Ver formato de importación Excel"
          >
            ?
          </button>
          <button
            onClick={exportarExcel}
            disabled={proyectosFiltrados.length === 0}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#6366F1' }}
            title="Exportar proyectos visibles a Excel"
          >
            ⬇ Exportar Excel
          </button>
          <button
            onClick={generarReporte}
            disabled={proyectosFiltrados.length === 0}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#0EA5E9' }}
            title="Exportar reporte multi-hoja: todos + una hoja por jefe"
          >
            📊 Generar Reporte
          </button>
          <label
            className={`px-4 py-2 rounded-lg text-white font-medium transition-all cursor-pointer hover:opacity-90 ${procesando ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: '#10B981' }}
            title="Importar proyectos (PROYECTO, LINEA, ESTADO, TIPO, RENDIBLE, CECO, JEFE)"
          >
            {procesando ? 'Procesando...' : 'Importar proyectos'}
            <input type="file" accept=".xlsx,.xls" onChange={importarExcel} className="hidden" disabled={procesando} />
          </label>
          <button
            onClick={abrirModalCrear}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: '#FF5100' }}
          >
            + Nuevo Proyecto
          </button>
          {esAdmin && (
            <button
              onClick={eliminarTodos}
              disabled={eliminandoTodos || proyectos.length === 0}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all disabled:opacity-50"
            >
              {eliminandoTodos ? 'Eliminando...' : 'Eliminar todos'}
            </button>
          )}
          <span className="text-sm text-gray-500">
            {proyectosFiltrados.length} de {proyectos.length} proyectos
          </span>
        </div>
      </div>

      {/* Instrucciones Excel */}
      {mostrarInstrucciones && (
        <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-300">
          <h3 className="font-bold text-gray-800 mb-2">Formato Excel para Importar Proyectos:</h3>
          <div className="bg-white p-3 rounded border border-yellow-200 font-mono text-sm mb-2 flex flex-wrap gap-3">
            <span className="text-blue-600 font-bold">PROYECTO</span>
            <span className="text-gray-400">|</span>
            <span className="text-green-600 font-bold">LINEA</span>
            <span className="text-gray-400">|</span>
            <span className="text-purple-600 font-bold">ESTADO</span>
            <span className="text-gray-400">|</span>
            <span className="text-orange-600 font-bold">TIPO</span>
            <span className="text-gray-400">|</span>
            <span className="text-red-600 font-bold">RENDIBLE</span>
            <span className="text-gray-400">|</span>
            <span className="text-indigo-600 font-bold">CECO</span>
            <span className="text-gray-400">|</span>
            <span className="text-teal-600 font-bold">JEFE</span>
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>- <strong>PROYECTO</strong>: Nombre del proyecto (requerido)</li>
            <li>- <strong>LINEA</strong>: Línea de negocio (requerido)</li>
            <li>- <strong>ESTADO</strong>: Efectivo, No Efectivo, Adjudicado, Cancelado (opcional)</li>
            <li>- <strong>TIPO</strong>: Tipo de proyecto (opcional)</li>
            <li>- <strong>RENDIBLE</strong>: Sí / No (opcional)</li>
            <li>- <strong>CECO</strong>: Código de centro de costo (opcional)</li>
            <li>- <strong>JEFE</strong>: Nombre exacto del colaborador (opcional, debe existir en tabla Colaboradores)</li>
          </ul>
        </div>
      )}

      {/* Info */}
      <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-sm text-gray-600">
          Aquí puedes gestionar los proyectos base.
        </p>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando proyectos...</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold">#</ResizableTh>
                <FilterableTh col="linea" label="Línea" opciones={opcionesLinea} filtro={filtros.linea || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'linea'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol === 'linea'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="proyecto" label="Proyecto" opciones={opcionesProyecto} filtro={filtros.proyecto || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'proyecto'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol === 'proyecto'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="jefe" label="Jefe" opciones={opcionesJefe} filtro={filtros.jefe || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'jefe'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol === 'jefe'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="ingresos" label="Ingresos" align="right" style={{ width: '110px' }}
                  opciones={opcionesIngresos} filtro={filtros.ingresos || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'ingresos'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'ingresos'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="hh" label="HH" align="right" style={{ width: '100px' }}
                  opciones={opcionesHH} filtro={filtros.hh || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'hh'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'hh'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="gastos" label="GGOO" align="right" style={{ width: '100px' }}
                  opciones={opcionesGastos} filtro={filtros.gastos || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'gastos'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'gastos'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="margen" label="Margen" align="right" style={{ width: '110px' }}
                  opciones={opcionesMargen} filtro={filtros.margen || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'margen'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'margen'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="estado" label="Estado" opciones={opcionesEstado} filtro={filtros.estado || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'estado'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol === 'estado'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                {!esVistaOportunidades && <FilterableTh col="tipo" label="Tipo" opciones={opcionesTipo} filtro={filtros.tipo || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'tipo'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol === 'tipo'} ordenDir={ordenDir} onOrdenar={toggleOrden} />}
                {!esVistaOportunidades && <FilterableTh col="financista" label="Financista" opciones={opcionesPorColumna('financista', p => p.financistas?.nombre)} filtro={filtros.financista || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'financista'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol === 'financista'} ordenDir={ordenDir} onOrdenar={toggleOrden} />}
                {!esVistaOportunidades && (
                  <>
                <FilterableTh col="region" label="Región" opciones={opcionesPorColumna('region', p => p.region)} filtro={filtros.region || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'region'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol === 'region'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="industria" label="Industria" opciones={opcionesPorColumna('industria', p => p.industria)} filtro={filtros.industria || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'industria'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol === 'industria'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="rendible" label="Rendible" align="center" opciones={opcionesRendible} filtro={filtros.rendible || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'rendible'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol === 'rendible'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="ceco" label="CECO" opciones={opcionesCeco} filtro={filtros.ceco || []} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'ceco'} onToggleDropdown={setDropdownFiltro} sortable ordenActiva={ordenCol === 'ceco'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="hp" label="HP" align="center" style={{ width: '60px' }}
                  opciones={['Sí', 'No']} filtro={filtros.hp || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'hp'} onToggleDropdown={setDropdownFiltro} />
                <FilterableTh col="margenReal" label="margen real?" align="center" style={{ width: '100px' }}
                  opciones={['Sí', 'No']} filtro={filtros.margenReal || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'margenReal'} onToggleDropdown={setDropdownFiltro} />
                  </>
                )}
                <FilterableTh col="fechaAdj" label="Fecha Adj" align="center" style={{ width: '95px' }}
                  opciones={opcionesFechaAdj} filtro={filtros.fechaAdj || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'fechaAdj'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'fechaAdj'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <ResizableTh className="py-3 px-4 text-gray-800 font-semibold bg-[#FFF5F0]" style={{ minWidth: '180px' }}>Comentarios</ResizableTh>
                <ResizableTh className="text-center py-3 px-4 text-gray-800 font-semibold">Acciones</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {proyectosPagina.map((p, index) => {
                const globalIndex = pagina * FILAS_POR_PAGINA + index + 1
                const hh     = costoPorProyecto[normalizar(p.nombre)] || 0
                const ing    = parseFloat(p.ingresos) || 0
                const gastos = parseFloat(p.gastos)   || 0
                const margen = ing - hh - gastos
                const enHP   = proyEnHP.has(normalizar(p.nombre))
                const enIR   = proyEnIngresoReal.has(normalizar(p.nombre))
                return (
                  <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                    <td className="py-2 px-4 text-gray-500 text-sm">{globalIndex}</td>
                    <td className="py-2 px-4 text-gray-600 text-sm truncate" title={p.ceco}>{p.ceco}</td>
                    <td className="py-2 px-4 text-gray-800 font-medium text-sm">{p.nombre}</td>
                    <td className="py-2 px-2">
                      <select
                        value={p.jefe_id || ''}
                        onChange={e => guardarJefe(p, e.target.value)}
                        className="w-full border border-gray-200 bg-transparent focus:bg-white focus:border-blue-300 rounded px-1 py-0.5 text-sm text-gray-700"
                      >
                        <option value="">Sin asignar</option>
                        {colaboradores.map(c => (
                          <option key={c.id} value={c.id}>{c.colaborador}</option>
                        ))}
                      </select>
                    </td>
                    <td
                      className="py-2 px-3 text-right tabular-nums text-sm cursor-pointer hover:bg-orange-50 group"
                      onClick={() => abrirModalEdicionFin(p, 'ingresos')}
                      title="Click para editar Ingresos"
                    >
                      {ing > 0
                        ? <span className="font-medium text-gray-800 group-hover:text-orange-600">{fmt(ing)}</span>
                        : <span className="text-gray-300 group-hover:text-orange-400">—</span>
                      }
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-sm">
                      {hh > 0 ? <span className="font-medium text-gray-800">{fmt(hh)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td
                      className="py-2 px-3 text-right tabular-nums text-sm cursor-pointer hover:bg-orange-50 group"
                      onClick={() => abrirModalEdicionFin(p, 'gastos')}
                      title="Click para editar GGOO"
                    >
                      {gastos > 0
                        ? <span className="font-medium text-gray-800 group-hover:text-orange-600">{fmt(gastos)}</span>
                        : <span className="text-gray-300 group-hover:text-orange-400">—</span>
                      }
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-sm font-semibold">
                      {(ing > 0 || hh > 0 || gastos > 0)
                        ? <span className={margen >= 0 ? 'text-green-700' : 'text-red-600'}>{fmt(margen)}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="py-2 px-2">{badgeEstadoSelect(p.estado, p, solicitarCambioEstado)}</td>
                    {!esVistaOportunidades && (
                      <>
                    <td className="py-2 px-4 text-gray-600 text-sm">{p.tipo || <span className="text-gray-400 italic">-</span>}</td>
                    <td className="py-2 px-4 text-gray-600 text-sm truncate">{p.financistas?.nombre || <span className="text-gray-400 italic">-</span>}</td>
                    <td className="py-2 px-4 text-gray-600 text-sm">{p.region || <span className="text-gray-400 italic">-</span>}</td>
                    <td className="py-2 px-4 text-gray-600 text-sm">{p.industria || <span className="text-gray-400 italic">-</span>}</td>
                    <td className="py-2 px-4 text-center">{badgeRendible(p.rendible)}</td>
                    <td className="py-2 px-4 text-gray-600 text-sm">{p.ceco_codigo || <span className="text-gray-400 italic">-</span>}</td>
                    <td className="py-2 px-2 text-center">
                      {enHP
                        ? <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Sí</span>
                        : <span className="text-gray-300 text-xs">No</span>
                      }
                    </td>
                    <td className="py-2 px-2 text-center">
                      {enIR
                        ? <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Sí</span>
                        : <span className="text-gray-300 text-xs">No</span>
                      }
                    </td>
                      </>
                    )}
                    <td className="py-2 px-1 text-center">
                      {puedeEditarFechaAdjudicacion(p.estado) ? (
                        <input
                          type="text"
                          defaultValue={p.fecha_adjudicacion || ''}
                          onBlur={e => actualizarFechaAdjudicacion(p, e.target.value, v => { e.target.value = v })}
                          className="w-full text-xs px-1 py-0.5 border border-gray-200 rounded text-center"
                          placeholder="ene-26"
                          maxLength={6}
                        />
                      ) : (
                        <span className="text-xs text-gray-500">{p.fecha_adjudicacion || <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>
                    <td className="py-1 px-2" style={{ minWidth: '180px' }}>
                      <textarea
                        defaultValue={p.comentarios || ''}
                        onBlur={e => guardarComentario(p, e.target.value)}
                        rows={2}
                        className="w-full text-xs px-2 py-1 border border-gray-200 rounded resize-none focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 bg-transparent hover:bg-white"
                        placeholder="Agregar comentario..."
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => abrirModalEditar(p)}
                          className="px-2 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all text-xs"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarProyecto(p)}
                          disabled={enHP || enIR}
                          className={`px-2 py-1 rounded-lg text-white font-medium transition-all text-xs ${(enHP || enIR) ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
                          title={enHP ? 'No se puede eliminar: tiene HH cargadas' : enIR ? 'No se puede eliminar: tiene datos en Ingreso Real Acumulado' : 'Eliminar proyecto'}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {proyectosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={18 - columnasOcultasCount} className="py-12 text-center text-gray-400">
                    {busqueda ? 'No hay proyectos que coincidan con la búsqueda' : 'No hay proyectos cargados'}
                  </td>
                </tr>
              )}
            </tbody>
            {proyectosFiltrados.length > 0 && (() => {
              const totIng    = proyectosFiltrados.reduce((s, p) => s + (parseFloat(p.ingresos) || 0), 0)
              const totHH     = proyectosFiltrados.reduce((s, p) => s + (costoPorProyecto[normalizar(p.nombre)] || 0), 0)
              const totGastos = proyectosFiltrados.reduce((s, p) => s + (parseFloat(p.gastos) || 0), 0)
              const totMargen = totIng - totHH - totGastos
              return (
                <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 5 }}>
                  <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
                    <td className="py-2 px-4 text-gray-600 text-sm" colSpan={4}>Total ({proyectosFiltrados.length})</td>
                    <td className="py-2 px-3 text-right tabular-nums text-sm text-gray-800">{fmt(totIng)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-sm text-gray-800">{fmt(totHH)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-sm text-gray-800">{fmt(totGastos)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums text-sm ${totMargen >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(totMargen)}</td>
                    <td colSpan={10 - columnasOcultasCount} />
                  </tr>
                </tfoot>
              )
            })()}
          </table>
        </div>
      )}

      {/* Paginación */}
      {!loading && proyectosFiltrados.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
          <span>{pagina * FILAS_POR_PAGINA + 1}–{Math.min((pagina + 1) * FILAS_POR_PAGINA, proyectosFiltrados.length)} de {proyectosFiltrados.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPagina(p => p + 1)} disabled={(pagina + 1) * FILAS_POR_PAGINA >= proyectosFiltrados.length}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

      {/* Modal Crear Proyecto */}
      {modalCrear && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-screen overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Nuevo Proyecto</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto *</label>
              <input type="text" value={formData.nombre} autoFocus
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Nombre del proyecto" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Línea *</label>
              <SelectLinea value={formData.ceco} onChange={(e) => setFormData({ ...formData, ceco: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Jefe de Proyecto</label>
              <SelectJefe value={formData.jefe_id} onChange={(e) => setFormData({ ...formData, jefe_id: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Seleccionar estado...</option>
                {ESTADOS_PROYECTO.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Seleccionar tipo...</option>
                {TIPOS_PROYECTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rendible</label>
              <select value={formData.rendible} onChange={(e) => setFormData({ ...formData, rendible: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Seleccionar...</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de adjudicación {['Adjudicado', 'Cancelado', 'Meta'].includes(normalizarEstadoProyecto(formData.estado)) ? '(opcional)' : '*'}
              </label>
              <input
                type="text"
                value={formData.fecha_adjudicacion}
                onChange={(e) => setFormData({ ...formData, fecha_adjudicacion: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="ene-26"
                maxLength={6}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">CECO</label>
              <SelectCeco value={formData.ceco_codigo} onChange={(e) => setFormData({ ...formData, ceco_codigo: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Financista</label>
              <SelectFinancista value={formData.financista_id} onChange={(e) => setFormData({ ...formData, financista_id: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Región</label>
              <SelectRegion value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Industria</label>
              <input type="text" value={formData.industria}
                onChange={(e) => setFormData({ ...formData, industria: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: Minería, Energía, Salud..." />
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setModalCrear(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-all">
                Cancelar
              </button>
              <button onClick={crearProyecto}
                className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#FF5100' }}>
                Crear Proyecto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edición Financiera (Ingresos / GGOO) */}
      {modalEdicionFin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-1">
              Editar {modalEdicionFin.campo === 'gastos' ? 'GGOO' : 'Ingresos'}
            </h3>
            <p className="text-sm text-gray-500 mb-4 truncate">{modalEdicionFin.proyecto.nombre}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor ($)</label>
              <input
                type="number"
                value={valorEditandoFin}
                onChange={e => setValorEditandoFin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
              <textarea
                value={motivoCambioFin}
                onChange={e => setMotivoCambioFin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows={2}
                placeholder="Motivo del cambio..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModalEdicionFin(null)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-all">
                Cancelar
              </button>
              <button onClick={guardarEdicionFin} disabled={procesandoFin}
                className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#FF5100' }}>
                {procesandoFin ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambio de Estado con Motivo */}
      {modalMotivoEstado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-1">Cambiar Estado</h3>
            <p className="text-sm text-gray-600 mb-1 truncate">{modalMotivoEstado.proyecto.nombre}</p>
            <p className="text-sm text-gray-500 mb-4">
              {normalizarEstadoProyecto(modalMotivoEstado.proyecto.estado) || 'Sin estado'} → <strong>{modalMotivoEstado.nuevoEstado || 'Sin estado'}</strong>
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
              <textarea
                value={motivoAccionEstado}
                onChange={e => setMotivoAccionEstado(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows={2}
                placeholder="Motivo del cambio de estado..."
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModalMotivoEstado(null)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-all">
                Cancelar
              </button>
              <button onClick={confirmarCambioEstado}
                className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#FF5100' }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Proyecto */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-screen overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Editar Proyecto</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto *</label>
              <input type="text" value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Línea *</label>
              <SelectLinea value={formData.ceco} onChange={(e) => setFormData({ ...formData, ceco: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Jefe de Proyecto</label>
              <SelectJefe value={formData.jefe_id} onChange={(e) => setFormData({ ...formData, jefe_id: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Seleccionar estado...</option>
                {ESTADOS_PROYECTO.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Seleccionar tipo...</option>
                {TIPOS_PROYECTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rendible</label>
              <select value={formData.rendible} onChange={(e) => setFormData({ ...formData, rendible: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Seleccionar...</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de adjudicación {['Adjudicado', 'Cancelado', 'Meta'].includes(normalizarEstadoProyecto(formData.estado)) ? '(opcional)' : '*'}
              </label>
              <input
                type="text"
                value={formData.fecha_adjudicacion}
                onChange={(e) => setFormData({ ...formData, fecha_adjudicacion: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="ene-26"
                maxLength={6}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">CECO</label>
              <SelectCeco value={formData.ceco_codigo} onChange={(e) => setFormData({ ...formData, ceco_codigo: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Financista</label>
              <SelectFinancista value={formData.financista_id} onChange={(e) => setFormData({ ...formData, financista_id: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Región</label>
              <SelectRegion value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Industria</label>
              <input type="text" value={formData.industria}
                onChange={(e) => setFormData({ ...formData, industria: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: Minería, Energía, Salud..." />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del cambio *</label>
              <textarea value={motivoCambio} onChange={(e) => setMotivoCambio(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows={2} placeholder="Explica el motivo del cambio..." />
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setModalEditar(null)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-all">
                Cancelar
              </button>
              <button onClick={guardarEdicion}
                className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#FF5100' }}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
