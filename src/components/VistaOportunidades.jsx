import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import ResizableTh from './ResizableTh'

const ESTADOS_OPT = ['Efectivo', 'No Efectivo', 'Adjudicado']

function fmt(val) {
  const millones = (parseFloat(val) || 0) / 1_000_000
  return '$' + millones.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function ThSort({ col, label, align = 'left', activo, dir, onClick, style, opciones, filtro, onFiltro, dropdownAbierto, onToggleDropdown }) {
  const arrow = activo ? (dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'
  const tieneOpciones = opciones && opciones.length > 0
  const btnRef = useRef(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  function handleToggle(e) {
    e.stopPropagation()
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + window.scrollY, left: r.left + window.scrollX })
    }
    onToggleDropdown(dropdownAbierto ? null : col)
  }

  return (
    <ResizableTh
      className={`py-2 px-4 text-gray-800 font-semibold select-none transition-colors text-${align} ${filtro ? 'bg-orange-100' : 'bg-[#FFF5F0]'}`}
      style={style}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-between'}`}>
        <span
          className="cursor-pointer hover:text-orange-600 py-1"
          onClick={() => onClick(col)}
        >
          {label}<span className="text-gray-400 text-xs ml-0.5">{arrow}</span>
        </span>
        {tieneOpciones && (
          <div className="flex-shrink-0">
            <button
              ref={btnRef}
              onClick={handleToggle}
              className={`text-xs px-0.5 py-1 rounded transition-all leading-none ${filtro ? 'text-orange-500 font-bold' : 'text-gray-400 hover:text-gray-700'}`}
              title={filtro ? `Filtro: ${filtro}` : 'Filtrar'}
            >
              {filtro ? '▼' : '⏷'}
            </button>
            {dropdownAbierto && createPortal(
              <div
                className="bg-white border border-gray-200 rounded-lg shadow-xl min-w-[180px] max-h-[260px] overflow-y-auto"
                style={{ position: 'absolute', top: dropPos.top + 2, left: dropPos.left, zIndex: 9999 }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => { onFiltro(col, ''); onToggleDropdown(null) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-b border-gray-100 ${!filtro ? 'font-semibold text-orange-600' : 'text-gray-600'}`}
                >
                  (Todos)
                </button>
                {opciones.map(op => (
                  <button
                    key={op}
                    onClick={() => { onFiltro(col, op); onToggleDropdown(null) }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 ${filtro === op ? 'font-semibold text-orange-600 bg-orange-50' : 'text-gray-700'}`}
                  >
                    {op}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
        )}
      </div>
    </ResizableTh>
  )
}

function badgeEstado(estado, oportunidad, onSolicitar) {
  const colores = {
    'Efectivo':    'bg-green-100 text-green-800 border-green-300',
    'No Efectivo': 'bg-red-100 text-red-800 border-red-300',
    'Adjudicado':  'bg-blue-100 text-blue-800 border-blue-300',
  }
  const cls = colores[estado] || 'bg-gray-100 text-gray-600 border-gray-300'
  return (
    <select
      value={estado || ''}
      onChange={(e) => onSolicitar(oportunidad, e.target.value)}
      className={`px-2 py-1 rounded-full text-xs font-medium border cursor-pointer focus:outline-none ${cls}`}
    >
      <option value="">Sin estado</option>
      {ESTADOS_OPT.map(e => <option key={e} value={e}>{e}</option>)}
    </select>
  )
}

export default function VistaOportunidades({ user }) {
  const [oportunidades, setOportunidades] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false)
  const [filtroLinea, setFiltroLinea] = useState('')
  const [ordenCol, setOrdenCol] = useState(null)
  const [ordenDir, setOrdenDir] = useState('asc')

  const [modalEdicion, setModalEdicion] = useState(null)
  const [valorEditando, setValorEditando] = useState('')
  const [motivoCambio, setMotivoCambio] = useState('')

  const [modalMotivo, setModalMotivo] = useState(null)   // { tipo, textoAccion, proyectoNombre, payload }
  const [motivoAccion, setMotivoAccion] = useState('')

  const [modalAgregar, setModalAgregar] = useState(false)
  const [formAgregar, setFormAgregar] = useState({ proyecto_id: '', ingresos: '', hh: '', gastos: '' })

  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)

  useEffect(() => {
    cargarDatos()
    cargarProyectos()
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  async function cargarProyectos() {
    const { data } = await supabase
      .from('proyectos')
      .select('id, nombre, ceco')
      .order('nombre', { ascending: true })
    setProyectos(data || [])
  }

  async function cargarDatos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('oportunidades')
      .select(`
        *,
        proyectos:proyecto_id (id, nombre, ceco, estado, colaboradores!jefe_id(colaborador))
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error cargando oportunidades:', error)
    } else {
      setOportunidades(data || [])
    }
    setLoading(false)
  }

  // ── SOLICITAR CAMBIO DE ESTADO (abre modal de motivo) ──
  function solicitarCambioEstado(oportunidad, nuevoEstado) {
    setModalMotivo({
      tipo: 'estado',
      textoAccion: `Cambiar estado a "${nuevoEstado || 'Sin estado'}"`,
      proyectoNombre: oportunidad.proyectos?.nombre,
      payload: { oportunidad, nuevoEstado }
    })
    setMotivoAccion('')
  }

  // ── SOLICITAR ELIMINAR (abre modal de motivo) ──
  function solicitarEliminar(oportunidad) {
    setModalMotivo({
      tipo: 'eliminar',
      textoAccion: 'Eliminar oportunidad',
      proyectoNombre: oportunidad.proyectos?.nombre,
      payload: { oportunidad }
    })
    setMotivoAccion('')
  }

  // ── CONFIRMAR ACCIÓN CON MOTIVO ──
  async function confirmarAccionConMotivo() {
    if (!motivoAccion.trim()) {
      toast.error('Debes ingresar un motivo')
      return
    }

    const { tipo, payload } = modalMotivo

    if (tipo === 'estado') {
      const { oportunidad, nuevoEstado } = payload
      const estadoAnterior = oportunidad.proyectos?.estado || ''

      const { error } = await supabase
        .from('proyectos')
        .update({ estado: nuevoEstado || null })
        .eq('id', oportunidad.proyecto_id)

      if (error) { toast.error('Error al cambiar estado: ' + error.message); return }

      await supabase.from('cambios').insert({
        proyecto_id:     oportunidad.proyecto_id,
        campo:           'ESTADO',
        valor_anterior:  estadoAnterior,
        valor_nuevo:     nuevoEstado || '',
        usuario:         user?.email || 'sistema',
        motivo:          motivoAccion,
        tipo_cambio:     'oportunidad',
        proyecto_nombre: oportunidad.proyectos?.nombre
      })

      setOportunidades(prev => prev.map(o =>
        o.proyecto_id === oportunidad.proyecto_id
          ? { ...o, proyectos: { ...o.proyectos, estado: nuevoEstado || null } }
          : o
      ))
      toast.success('Estado actualizado')

    } else if (tipo === 'eliminar') {
      const { oportunidad } = payload

      await supabase.from('cambios').insert({
        proyecto_id:     oportunidad.proyecto_id,
        campo:           'OPORTUNIDAD ELIMINADA',
        valor_anterior:  `Ingresos: ${oportunidad.ingresos} | HH: ${oportunidad.hh} | GGOO: ${oportunidad.gastos}`,
        valor_nuevo:     '',
        usuario:         user?.email || 'sistema',
        motivo:          motivoAccion,
        tipo_cambio:     'oportunidad',
        proyecto_nombre: oportunidad.proyectos?.nombre
      })

      const { error } = await supabase.from('oportunidades').delete().eq('id', oportunidad.id)
      if (error) { toast.error('Error al eliminar'); return }

      toast.success('Oportunidad eliminada')
      cargarDatos()
    }

    setModalMotivo(null)
    setMotivoAccion('')
  }

  // ── AGREGAR OPORTUNIDAD ──
  async function agregarOportunidad() {
    if (!formAgregar.proyecto_id) {
      toast.error('Selecciona un proyecto')
      return
    }
    const { error } = await supabase.from('oportunidades').insert({
      proyecto_id: formAgregar.proyecto_id,
      ingresos:    parseFloat(formAgregar.ingresos) || 0,
      hh:          parseFloat(formAgregar.hh)       || 0,
      gastos:      parseFloat(formAgregar.gastos)   || 0,
      creador:     user?.email || 'sistema',
    })
    if (error) { toast.error('Error al agregar: ' + error.message); return }
    toast.success('Oportunidad agregada')
    setModalAgregar(false)
    setFormAgregar({ proyecto_id: '', ingresos: '', hh: '', gastos: '' })
    cargarDatos()
  }

  // ── EDICIÓN NUMÉRICA (Ingresos / HH / GGOO) ──
  function abrirModalEdicion(oportunidad, campo, valorActual) {
    setModalEdicion({ oportunidad, campo })
    setValorEditando(valorActual?.toString() || '0')
    setMotivoCambio('')
  }

  async function guardarEdicion() {
    if (!modalEdicion) return

    const { oportunidad, campo } = modalEdicion
    const valorAnterior = oportunidad[campo]
    const valorNuevo = parseFloat(valorEditando) || 0

    if (valorAnterior === valorNuevo) {
      setModalEdicion(null)
      return
    }

    if (!motivoCambio.trim()) {
      toast.error('Debes ingresar un motivo para el cambio')
      return
    }

    const { error } = await supabase
      .from('oportunidades')
      .update({ [campo]: valorNuevo })
      .eq('id', oportunidad.id)

    if (error) {
      toast.error('Error al actualizar')
      return
    }

    const { error: errorCambio } = await supabase.from('cambios').insert({
      proyecto_id:     oportunidad.proyecto_id,
      campo:           campo.toUpperCase(),
      valor_anterior:  valorAnterior?.toString() || '0',
      valor_nuevo:     valorNuevo.toString(),
      usuario:         user?.email || 'sistema',
      motivo:          motivoCambio,
      tipo_cambio:     'oportunidad',
      proyecto_nombre: oportunidad.proyectos?.nombre
    })

    if (errorCambio) {
      console.error('Error registrando cambio:', errorCambio)
      toast.warning('Valor actualizado pero no se registró el cambio')
    }

    toast.success('Valor actualizado')
    setModalEdicion(null)
    cargarDatos()
  }

  // ── IMPORTAR EXCEL ──
  async function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return

    setProcesando(true)
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(worksheet)

        const parseNumero = (val) => {
          if (val === null || val === undefined || val === '') return 0
          if (typeof val === 'number') return val
          // Formato latino: punto = separador de miles, coma = decimal
          // Ej: "1.234,56" → 1234.56
          const str = String(val).trim().replace(/\./g, '').replace(',', '.')
          return parseFloat(str) || 0
        }

        let insertados = 0
        let noEncontrados = []
        let errores = 0

        for (const row of data) {
          const proyectoNombre = (row.PROYECTO || row.proyecto || '').toString().trim()
          const ingresos = parseNumero(row.INGRESOS || row.ingresos)
          const hh       = parseNumero(row.HH       || row.hh)
          const gastos   = parseNumero(row.GGOO     || row.ggoo || row.GASTOS || row.gastos)

          if (!proyectoNombre) {
            errores++
            continue
          }

          // Buscar proyecto — intenta match por código prefijo, si no por nombre exacto
          const codigoMatch = proyectoNombre.match(/^[\d]+\.[\w]+\.[\w]+/)
          const busq = codigoMatch ? codigoMatch[0] : proyectoNombre

          const { data: encontrados } = await supabase
            .from('proyectos')
            .select('id, nombre')
            .ilike('nombre', `${busq}%`)
            .limit(1)

          if (!encontrados || encontrados.length === 0) {
            noEncontrados.push(proyectoNombre)
            continue   // ← no insertar si no existe en proyectos
          }

          const { error: errorInsert } = await supabase.from('oportunidades').insert({
            proyecto_id: encontrados[0].id,
            ingresos,
            hh,
            gastos,
            creador: user?.email || 'sistema',
          })

          if (errorInsert) {
            console.error('Error insert:', errorInsert)
            errores++
          } else {
            insertados++
          }
        }

        if (noEncontrados.length > 0) {
          toast.warning(
            `${noEncontrados.length} proyecto(s) no encontrado(s) — no importados:\n${noEncontrados.slice(0, 5).join(', ')}${noEncontrados.length > 5 ? '...' : ''}`,
            { autoClose: 6000 }
          )
        }
        if (errores > 0) {
          toast.warning(`${errores} fila(s) con error al insertar`)
        }
        toast.success(`Importación: ${insertados} oportunidades creadas`)
        cargarDatos()
      } catch (error) {
        console.error('Error:', error)
        toast.error('Error: ' + error.message)
      }
      setProcesando(false)
    }

    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  async function borrarTodas() {
    if (!confirm('¿Eliminar TODAS las oportunidades? Esta acción no se puede deshacer.')) return
    if (!confirm('Confirmación final: ¿seguro?')) return
    const { error } = await supabase
      .from('oportunidades')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      toast.error('Error al eliminar')
    } else {
      toast.success('Todas las oportunidades eliminadas')
      cargarDatos()
    }
  }

  // ── TOGGLE ORDEN ──
  function toggleOrden(col) {
    if (ordenCol === col) {
      setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setOrdenCol(col)
      setOrdenDir('asc')
    }
  }

  function setFiltro(col, valor) {
    setFiltros(prev => ({ ...prev, [col]: valor }))
  }

  // ── LÍNEAS ÚNICAS PARA EL FILTRO SUPERIOR ──
  const lineasUnicas = [...new Set(
    oportunidades.map(o => o.proyectos?.ceco).filter(Boolean)
  )].sort()

  // ── OPCIONES ÚNICAS POR COLUMNA (para dropdowns) ──
  const opcionesLinea    = [...new Set(oportunidades.map(o => o.proyectos?.ceco).filter(Boolean))].sort()
  const opcionesProyecto = [...new Set(oportunidades.map(o => o.proyectos?.nombre).filter(Boolean))].sort()
  const opcionesJefe     = [...new Set(oportunidades.map(o => o.proyectos?.colaboradores?.colaborador).filter(Boolean))].sort()
  const opcionesEstado   = [...new Set(oportunidades.map(o => o.proyectos?.estado).filter(Boolean))].sort()

  // ── FILTRO Y ORDEN ──
  const oportunidadesFiltradas = oportunidades
    .filter(o => {
      const q = busqueda.toLowerCase()
      const jefe = o.proyectos?.colaboradores?.colaborador
      const matchBusqueda = (
        o.proyectos?.nombre?.toLowerCase().includes(q) ||
        o.proyectos?.ceco?.toLowerCase().includes(q) ||
        o.proyectos?.estado?.toLowerCase().includes(q) ||
        jefe?.toLowerCase().includes(q)
      )
      const matchLinea    = !filtroLinea        || o.proyectos?.ceco === filtroLinea
      const matchFLinea   = !filtros.linea      || o.proyectos?.ceco === filtros.linea
      const matchFProy    = !filtros.proyecto   || o.proyectos?.nombre === filtros.proyecto
      const matchFJefe    = !filtros.jefe       || jefe === filtros.jefe
      const matchFEstado  = !filtros.estado     || o.proyectos?.estado === filtros.estado
      return matchBusqueda && matchLinea && matchFLinea && matchFProy && matchFJefe && matchFEstado
    })
    .sort((a, b) => {
      if (!ordenCol) return 0
      let vA, vB
      const margenA = (parseFloat(a.ingresos) || 0) - (parseFloat(a.hh) || 0) - (parseFloat(a.gastos) || 0)
      const margenB = (parseFloat(b.ingresos) || 0) - (parseFloat(b.hh) || 0) - (parseFloat(b.gastos) || 0)
      switch (ordenCol) {
        case 'linea':    vA = a.proyectos?.ceco    || ''; vB = b.proyectos?.ceco    || ''; break
        case 'proyecto': vA = a.proyectos?.nombre  || ''; vB = b.proyectos?.nombre  || ''; break
        case 'jefe':     vA = a.proyectos?.colaboradores?.colaborador || ''; vB = b.proyectos?.colaboradores?.colaborador || ''; break
        case 'ingresos': vA = parseFloat(a.ingresos) || 0; vB = parseFloat(b.ingresos) || 0; break
        case 'hh':       vA = parseFloat(a.hh)       || 0; vB = parseFloat(b.hh)       || 0; break
        case 'gastos':   vA = parseFloat(a.gastos)   || 0; vB = parseFloat(b.gastos)   || 0; break
        case 'margen':   vA = margenA; vB = margenB; break
        case 'estado':   vA = a.proyectos?.estado  || ''; vB = b.proyectos?.estado  || ''; break
        default: return 0
      }
      if (typeof vA === 'string') return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
      return ordenDir === 'asc' ? vA - vB : vB - vA
    })

  const totales = oportunidadesFiltradas.reduce((acc, o) => ({
    ingresos: acc.ingresos + (parseFloat(o.ingresos) || 0),
    hh:       acc.hh       + (parseFloat(o.hh)       || 0),
    gastos:   acc.gastos   + (parseFloat(o.gastos)   || 0),
  }), { ingresos: 0, hh: 0, gastos: 0 })
  totales.margen = totales.ingresos - totales.hh - totales.gastos

  const campoLabels = { ingresos: 'Ingresos', hh: 'HH', gastos: 'GGOO' }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      {/* Cabecera fija */}
      <div className="flex-shrink-0 pb-3">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Oportunidades</h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setModalAgregar(true)}
              className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: '#FF5100' }}
            >
              + Agregar Oportunidad
            </button>
            <input
              type="text"
              placeholder="Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <select
              value={filtroLinea}
              onChange={(e) => setFiltroLinea(e.target.value)}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 max-w-[220px]"
            >
              <option value="">Todas las líneas</option>
              {lineasUnicas.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <button
              onClick={() => setMostrarInstrucciones(!mostrarInstrucciones)}
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all"
              title="Info formato Excel"
            >
              ?
            </button>
            <label
              className={`px-4 py-2 rounded-lg text-white font-medium transition-all cursor-pointer hover:opacity-90 ${procesando ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ backgroundColor: '#10B981' }}
            >
              {procesando ? 'Procesando...' : 'Importar Excel'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={importarExcel}
                className="hidden"
                disabled={procesando}
              />
            </label>
            <button
              onClick={borrarTodas}
              disabled={loading || oportunidades.length === 0}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all disabled:opacity-50"
            >
              Borrar Todas
            </button>
          </div>
        </div>

        {/* Instrucciones */}
        {mostrarInstrucciones && (
          <div className="mb-3 p-4 rounded-lg bg-yellow-50 border border-yellow-300">
            <h3 className="font-bold text-gray-800 mb-2">Formato Excel para Importar Oportunidades:</h3>
            <div className="bg-white p-3 rounded border border-yellow-200 font-mono text-sm mb-2 flex flex-wrap gap-3">
              <span className="text-blue-600 font-bold">PROYECTO</span>
              <span className="text-gray-400">|</span>
              <span className="text-green-600 font-bold">INGRESOS</span>
              <span className="text-gray-400">|</span>
              <span className="text-orange-600 font-bold">HH</span>
              <span className="text-gray-400">|</span>
              <span className="text-red-600 font-bold">GGOO</span>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>- <strong>PROYECTO</strong>: Código/nombre del proyecto (debe existir en tabla Proyectos)</li>
              <li>- <strong>INGRESOS / HH / GGOO</strong>: Valores numéricos</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">Si el proyecto no existe en la tabla, la fila no se importa.</p>
          </div>
        )}
      </div>

      {/* Área scrollable (tabla) */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando oportunidades...</p>
          </div>
        ) : oportunidades.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 text-lg mb-2">No hay oportunidades registradas</p>
            <p className="text-gray-400 text-sm">Importa un archivo Excel para agregar oportunidades</p>
          </div>
        ) : (
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                <ThSort col="linea"    label="Línea"    align="left"   activo={ordenCol==='linea'}    dir={ordenDir} onClick={toggleOrden} style={{ width: '130px' }} opciones={opcionesLinea}    filtro={filtros.linea    || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro==='linea'}    onToggleDropdown={setDropdownFiltro} />
                <ThSort col="proyecto" label="Proyecto" align="left"   activo={ordenCol==='proyecto'} dir={ordenDir} onClick={toggleOrden}                             opciones={opcionesProyecto} filtro={filtros.proyecto || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro==='proyecto'} onToggleDropdown={setDropdownFiltro} />
                <ThSort col="jefe"     label="Jefe"     align="left"   activo={ordenCol==='jefe'}     dir={ordenDir} onClick={toggleOrden} style={{ width: '140px' }} opciones={opcionesJefe}     filtro={filtros.jefe     || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro==='jefe'}     onToggleDropdown={setDropdownFiltro} />
                <ThSort col="ingresos" label="Ingresos" align="right"  activo={ordenCol==='ingresos'} dir={ordenDir} onClick={toggleOrden} style={{ width: '110px' }} />
                <ThSort col="hh"       label="HH"       align="right"  activo={ordenCol==='hh'}       dir={ordenDir} onClick={toggleOrden} style={{ width: '110px' }} />
                <ThSort col="gastos"   label="GGOO"     align="right"  activo={ordenCol==='gastos'}   dir={ordenDir} onClick={toggleOrden} style={{ width: '110px' }} />
                <ThSort col="margen"   label="Margen"   align="right"  activo={ordenCol==='margen'}   dir={ordenDir} onClick={toggleOrden} style={{ width: '110px' }} />
                <ThSort col="estado"   label="Estado"   align="center" activo={ordenCol==='estado'}   dir={ordenDir} onClick={toggleOrden} style={{ width: '130px' }} opciones={opcionesEstado}   filtro={filtros.estado   || ''} onFiltro={setFiltro} dropdownAbierto={dropdownFiltro==='estado'}   onToggleDropdown={setDropdownFiltro} />
                <ResizableTh style={{ width: '42px', backgroundColor: '#FFF5F0' }}></ResizableTh>
              </tr>
            </thead>
            <tbody>
              {oportunidadesFiltradas.map(o => {
                const ingresos = parseFloat(o.ingresos) || 0
                const hh       = parseFloat(o.hh)       || 0
                const gastos   = parseFloat(o.gastos)   || 0
                const margen   = ingresos - hh - gastos
                return (
                  <tr key={o.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                    <td className="py-3 px-4 text-gray-600 text-sm max-w-[180px] truncate" title={o.proyectos?.ceco}>
                      {o.proyectos?.ceco || <span className="text-gray-400 italic">-</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-800 font-medium text-sm">
                      {o.proyectos?.nombre || 'Sin proyecto'}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm truncate" title={o.proyectos?.colaboradores?.colaborador}>
                      {o.proyectos?.colaboradores?.colaborador || <span className="text-gray-400 italic">-</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => abrirModalEdicion(o, 'ingresos', o.ingresos)}
                        className="px-2 py-1 rounded bg-gray-100 hover:bg-orange-50 hover:border-orange-300 text-gray-800 border border-gray-300 min-w-[80px] transition-all"
                        title="Click para editar"
                      >
                        {fmt(o.ingresos)}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => abrirModalEdicion(o, 'hh', o.hh)}
                        className="px-2 py-1 rounded bg-gray-100 hover:bg-orange-50 hover:border-orange-300 text-gray-800 border border-gray-300 min-w-[80px] transition-all"
                        title="Click para editar"
                      >
                        {fmt(o.hh)}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => abrirModalEdicion(o, 'gastos', o.gastos)}
                        className="px-2 py-1 rounded bg-gray-100 hover:bg-orange-50 hover:border-orange-300 text-gray-800 border border-gray-300 min-w-[80px] transition-all"
                        title="Click para editar"
                      >
                        {fmt(o.gastos)}
                      </button>
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(margen)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {badgeEstado(o.proyectos?.estado, o, solicitarCambioEstado)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => solicitarEliminar(o)}
                        className="text-gray-300 hover:text-red-500 transition-all text-base leading-none"
                        title="Eliminar oportunidad"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                )
              })}

              {/* Fila de totales */}
              <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                <td colSpan={3} className="py-3 px-4 text-gray-800">
                  TOTAL ({oportunidadesFiltradas.length})
                </td>
                <td className="py-3 px-4 text-right text-gray-800">{fmt(totales.ingresos)}</td>
                <td className="py-3 px-4 text-right text-gray-800">{fmt(totales.hh)}</td>
                <td className="py-3 px-4 text-right text-gray-800">{fmt(totales.gastos)}</td>
                <td className={`py-3 px-4 text-right ${totales.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(totales.margen)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Agregar Oportunidad */}
      {modalAgregar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Agregar Oportunidad</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto *</label>
              <select
                value={formAgregar.proyecto_id}
                onChange={e => setFormAgregar({ ...formAgregar, proyecto_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              >
                <option value="">-- Seleccionar proyecto --</option>
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ingresos</label>
              <input
                type="number"
                step="1"
                value={formAgregar.ingresos}
                onChange={e => setFormAgregar({ ...formAgregar, ingresos: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="0"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">HH</label>
              <input
                type="number"
                step="1"
                value={formAgregar.hh}
                onChange={e => setFormAgregar({ ...formAgregar, hh: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="0"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">GGOO</label>
              <input
                type="number"
                step="1"
                value={formAgregar.gastos}
                onChange={e => setFormAgregar({ ...formAgregar, gastos: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="0"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setModalAgregar(false); setFormAgregar({ proyecto_id: '', ingresos: '', hh: '', gastos: '' }) }}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={agregarOportunidad}
                className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#FF5100' }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de motivo (cambio de estado / eliminar) */}
      {modalMotivo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-1">
              {modalMotivo.textoAccion}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{modalMotivo.proyectoNombre}</p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
              <textarea
                value={motivoAccion}
                onChange={(e) => setMotivoAccion(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows={3}
                placeholder="Explica el motivo..."
                autoFocus
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setModalMotivo(null); setMotivoAccion('') }}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAccionConMotivo}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90 ${modalMotivo.tipo === 'eliminar' ? 'bg-red-600' : ''}`}
                style={modalMotivo.tipo !== 'eliminar' ? { backgroundColor: '#FF5100' } : {}}
              >
                {modalMotivo.tipo === 'eliminar' ? 'Eliminar' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edición numérica */}
      {modalEdicion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-1">
              Editar {campoLabels[modalEdicion.campo]}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {modalEdicion.oportunidad.proyectos?.nombre}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo valor</label>
              <input
                type="number"
                step="0.1"
                value={valorEditando}
                onChange={(e) => setValorEditando(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del cambio *</label>
              <textarea
                value={motivoCambio}
                onChange={(e) => setMotivoCambio(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows={3}
                placeholder="Explica el motivo del cambio..."
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModalEdicion(null)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#FF5100' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
