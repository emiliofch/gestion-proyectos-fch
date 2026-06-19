import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import ResizableTh from './ResizableTh'
import FilterableTh from './FilterableTh'

const MESES_ABREV   = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const AÑOS_2D = [24, 25, 26, 27, 28]
const MES_OPTIONS = AÑOS_2D.flatMap(y => MESES_ABREV.map(m => `${m}-${y}`))
const MESES_POBLAR = ['abr-26','may-26','jun-26','jul-26','ago-26','sep-26','oct-26','nov-26','dic-26']

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

function mesActual() {
  const now = new Date()
  return `${MESES_ABREV[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`
}

export default function VistaColaboradoresCostos() {
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [colaboradoresSet, setColaboradoresSet] = useState(new Set())
  const [colaboradoresRut, setColaboradoresRut] = useState({}) // normalize(nombre) → rut
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState(null)
  const [ordenDir, setOrdenDir] = useState('asc')
  const [pagina, setPagina] = useState(0)
  const FILAS_POR_PAGINA = 10
  const [progreso, setProgreso] = useState(null)
  const cancelarRef = useRef(false)
  const [modalAgregar, setModalAgregar] = useState(false)
  const [formAgregar, setFormAgregar] = useState({ colaborador: '', mes: '', costo_mes: '' })

  useEffect(() => {
    cargarDatos()
    cargarColaboradores()
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  async function cargarDatos() {
    setLoading(true)
    const PAGE = 1000
    let todas = [], from = 0
    while (true) {
      const { data, error } = await supabase
        .from('colaboradores_costos')
        .select('*')
        .range(from, from + PAGE - 1)
      if (error) { toast.error('Error al cargar: ' + error.message); break }
      todas = [...todas, ...(data || [])]
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    setFilas(todas)
    setLoading(false)
  }

  async function cargarColaboradores() {
    const { data } = await supabase.from('colaboradores').select('colaborador, rut')
    setColaboradoresSet(new Set((data || []).map(c => normalize(c.colaborador))))
    const rutMap = {}
    for (const c of (data || [])) rutMap[normalize(c.colaborador)] = c.rut || ''
    setColaboradoresRut(rutMap)
  }

  async function guardarCelda(id, col, valor) {
    const val = col === 'costo_mes' ? (parseFloat(valor) || 0) : valor.trim()
    const { error } = await supabase.from('colaboradores_costos').update({ [col]: val }).eq('id', id)
    if (error) { toast.error('Error al guardar: ' + error.message); return }
    toast.success('Guardado')
    setFilas(prev => prev.map(f => f.id === id ? { ...f, [col]: val } : f))
  }

  async function eliminarFila(id) {
    if (!confirm('¿Eliminar este registro?')) return
    const { error } = await supabase.from('colaboradores_costos').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar: ' + error.message); return }
    setFilas(prev => prev.filter(f => f.id !== id))
    toast.success('Registro eliminado')
  }

  async function confirmarAgregar() {
    const colaborador = formAgregar.colaborador.trim()
    const mes         = formAgregar.mes
    const costo_mes   = parseFloat(formAgregar.costo_mes) || 0
    if (!colaborador) { toast.error('El colaborador es obligatorio'); return }
    if (!mes)         { toast.error('El mes es obligatorio'); return }
    const { data, error } = await supabase
      .from('colaboradores_costos')
      .insert({ colaborador, mes, costo_mes })
      .select().single()
    if (error) { toast.error('Error al agregar: ' + error.message); return }
    setFilas(prev => [...prev, data])
    setModalAgregar(false)
    setFormAgregar({ colaborador: '', mes: '', costo_mes: '' })
    toast.success('Registro agregado')
  }

  async function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    if (filas.length > 0) {
      const ok = confirm(`La tabla tiene ${filas.length} registros. Al importar se BORRARÁN todos y se reemplazarán por los del Excel.\n\n¿Continuar?`)
      if (!ok) { e.target.value = ''; return }
    }
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws)

        const { error: errorBorrar } = await supabase
          .from('colaboradores_costos')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')
        if (errorBorrar) { toast.error('Error al limpiar: ' + errorBorrar.message); return }

        const batch = []
        for (const row of data) {
          const colaborador = (row.COLABORADOR || row.colaborador || '').toString().trim()
          const mes         = (row.MES         || row.mes         || '').toString().trim()
          const costo_mes   = parseFloat(row.COSTO_MES || row.costo_mes) || 0
          if (!colaborador || !mes) continue
          if (!MES_OPTIONS.includes(mes)) continue
          batch.push({ colaborador, mes, costo_mes })
        }

        if (batch.length === 0) { toast.error('No hay filas válidas'); setProgreso(null); return }

        cancelarRef.current = false
        setProgreso(0)
        let insertados = 0
        const CHUNK = 500
        for (let i = 0; i < batch.length; i += CHUNK) {
          if (cancelarRef.current) {
            toast.warning(`Importación cancelada. ${insertados} registros insertados.`)
            setProgreso(null)
            cargarDatos()
            return
          }
          const chunk = batch.slice(i, i + CHUNK)
          const { error } = await supabase.from('colaboradores_costos').insert(chunk)
          if (!error) insertados += chunk.length
          setProgreso(Math.round(Math.min((i + CHUNK) / batch.length, 1) * 100))
        }
        setProgreso('ok')
        setTimeout(() => setProgreso(null), 3000)
        toast.success(`Importación completada: ${insertados} registros`)
        cargarDatos()
      } catch (err) {
        toast.error('Error: ' + err.message)
        setProgreso(null)
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  function exportarExcel() {
    const filasOrdenadas = [...filasFiltradas].sort((a, b) => {
      const colCmp = (a.colaborador || '').localeCompare(b.colaborador || '', 'es')
      if (colCmp !== 0) return colCmp
      return mesToNum(a.mes) - mesToNum(b.mes)
    })
    const rows = filasOrdenadas.map(f => ({
      COLABORADOR:      f.colaborador || '',
      RUT:              colaboradoresRut[normalize(f.colaborador)] || '',
      MES:              f.mes         || '',
      COSTO_MES:        parseFloat(f.costo_mes) || 0,
      EN_COLABORADORES: colaboradoresSet.has(normalize(f.colaborador)) ? 'Sí' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    // Forzar MES como texto (índice 2: COLABORADOR, RUT, MES)
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let R = range.s.r; R <= range.e.r; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: 2 })
      if (ws[addr]) { ws[addr].t = 's'; ws[addr].z = '@' }
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ColaboradoresCostos')
    XLSX.writeFile(wb, `colaboradores_costos_${buildTimestamp()}.xlsx`)
  }

  function setFiltro(col, valor) {
    setFiltros(prev => ({ ...prev, [col]: valor }))
  }

  function toggleOrden(col) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
  }

  useEffect(() => { setPagina(0) }, [busqueda, filtros, ordenCol, ordenDir])

  function coincideFiltros(f) {
    const q = busqueda.toLowerCase()
    const enCol = colaboradoresSet.has(normalize(f.colaborador))
    const rut = colaboradoresRut[normalize(f.colaborador)] || ''
    const matchBusqueda    = !q || [f.colaborador, f.mes, rut].some(v => (v || '').toLowerCase().includes(q))
    const matchColaborador = !filtros.colaborador?.length || filtros.colaborador.includes(f.colaborador)
    const matchRut         = !filtros.rut?.length         || filtros.rut.includes(rut)
    const matchMes         = !filtros.mes?.length         || filtros.mes.includes(f.mes)
    const matchEnCol       = !filtros.enColaboradores?.length || (filtros.enColaboradores.includes('Sí') && enCol) || (filtros.enColaboradores.includes('No') && !enCol)
    return matchBusqueda && matchColaborador && matchRut && matchMes && matchEnCol
  }

  function opcionesPorColumna(obtenerValor, esmes = false) {
    const base = filas.map(obtenerValor).filter(Boolean)
    const uniq = [...new Set(base)]
    return esmes
      ? uniq.sort((a, b) => mesToNum(a) - mesToNum(b))
      : uniq.sort((a, b) => String(a).localeCompare(String(b), 'es'))
  }

  const opcionesColaborador = opcionesPorColumna(f => f.colaborador)
  const opcionesRut         = opcionesPorColumna(f => colaboradoresRut[normalize(f.colaborador)] || null)
  const opcionesMes         = opcionesPorColumna(f => f.mes, true)

  const filasFiltradas = filas
    .filter(coincideFiltros)
    .sort((a, b) => {
      if (!ordenCol) {
        const colCmp = (a.colaborador || '').localeCompare(b.colaborador || '', 'es')
        if (colCmp !== 0) return colCmp
        return mesToNum(a.mes) - mesToNum(b.mes)
      }
      let vA, vB
      switch (ordenCol) {
        case 'colaborador': vA = a.colaborador || ''; vB = b.colaborador || ''; break
        case 'mes': return ordenDir === 'asc' ? mesToNum(a.mes) - mesToNum(b.mes) : mesToNum(b.mes) - mesToNum(a.mes)
        case 'costo_mes': vA = parseFloat(a.costo_mes) || 0; vB = parseFloat(b.costo_mes) || 0; break
        default: return 0
      }
      if (typeof vA === 'string') return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
      return ordenDir === 'asc' ? vA - vB : vB - vA
    })

  const totalCosto = filasFiltradas.reduce((sum, f) => sum + (parseFloat(f.costo_mes) || 0), 0)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>

      {/* HEADER */}
      <div className="flex-shrink-0 pb-2">
        <div className="flex justify-between items-center mb-2 flex-wrap gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Costos Mensuales Colaboradores</h2>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => { setFormAgregar({ colaborador: '', mes: mesActual(), costo_mes: '' }); setModalAgregar(true) }}
              className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: '#FF5100' }}
            >
              + Agregar registro
            </button>
            <input
              type="text"
              placeholder="Buscar..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
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
              onClick={cargarDatos}
              className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-all"
            >
              Recargar
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Formato importación: columnas <strong>COLABORADOR</strong>, <strong>MES</strong> (ej: <em>ene-26</em>), <strong>COSTO_MES</strong>
        </p>

        {progreso !== null && (
          <div className="mt-2">
            {progreso === 'ok' ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-green-200"><div className="h-2 rounded-full bg-green-500 w-full" /></div>
                <span className="text-xs font-semibold text-green-600 whitespace-nowrap">Importación completada ✓</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-gray-200">
                  <div className="h-2 rounded-full bg-orange-500 transition-all duration-200" style={{ width: `${progreso}%` }} />
                </div>
                <span className="text-xs font-semibold text-orange-600 whitespace-nowrap w-10 text-right">{progreso}%</span>
                <button
                  onClick={() => { cancelarRef.current = true }}
                  className="text-xs px-2 py-0.5 rounded border border-red-300 text-red-500 hover:bg-red-50 whitespace-nowrap"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TABLA */}
      <div className="flex-1 min-h-0 overflow-auto border border-gray-200 rounded-lg">
        {loading ? (
          <div className="text-center py-12"><p className="text-gray-500">Cargando...</p></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                <ResizableTh className="py-3 px-4 text-gray-500 font-semibold bg-[#FFF5F0] text-center" style={{ width: '48px' }}>#</ResizableTh>
                <FilterableTh
                  col="colaborador" label="Colaborador" align="left" style={{ width: '220px' }}
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
                  col="mes" label="Mes" align="left" style={{ width: '160px' }}
                  opciones={opcionesMes} filtro={filtros.mes || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'mes'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'mes'} ordenDir={ordenDir} onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="costo_mes" label="Costo Mes" align="right" style={{ width: '160px' }}
                  opciones={[]} filtro={[]} onFiltro={() => {}} dropdownAbierto={false} onToggleDropdown={() => {}}
                  sortable ordenActiva={ordenCol === 'costo_mes'} ordenDir={ordenDir} onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="enColaboradores" label="En Colaboradores" align="center" style={{ width: '150px' }}
                  opciones={['Sí', 'No']} filtro={filtros.enColaboradores || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'enColaboradores'} onToggleDropdown={setDropdownFiltro}
                />
                <ResizableTh className="bg-[#FFF5F0]" style={{ width: '42px' }} />
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    {filas.length === 0 ? 'No hay registros. Usa "+ Agregar registro" o importa un Excel.' : 'Sin resultados para los filtros aplicados.'}
                  </td>
                </tr>
              )}
              {filasFiltradas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA).map((f, idx) => {
                const enCol = colaboradoresSet.has(normalize(f.colaborador))
                const mesOpts = MES_OPTIONS.includes(f.mes) ? MES_OPTIONS : [f.mes, ...MES_OPTIONS]
                return (
                  <tr key={f.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                    <td className="py-2 px-2 text-gray-400 text-sm text-center">{pagina * FILAS_POR_PAGINA + idx + 1}</td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        defaultValue={f.colaborador}
                        key={f.id + '_col'}
                        onBlur={e => guardarCelda(f.id, 'colaborador', e.target.value)}
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-sm"
                        placeholder="Nombre colaborador"
                      />
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-500 tabular-nums whitespace-nowrap">
                      {colaboradoresRut[normalize(f.colaborador)] || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2 px-2">
                      <select
                        defaultValue={f.mes || ''}
                        key={f.id + '_mes'}
                        onChange={e => guardarCelda(f.id, 'mes', e.target.value)}
                        className="w-full border border-gray-200 bg-transparent focus:bg-white focus:border-blue-300 rounded px-1 py-0.5 text-sm"
                      >
                        {mesOpts.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        defaultValue={f.costo_mes}
                        key={f.id + '_costo'}
                        onBlur={e => guardarCelda(f.id, 'costo_mes', e.target.value)}
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-sm text-right"
                        placeholder="0"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${enCol ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}>
                        {enCol ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => eliminarFila(f.id)}
                        className="text-gray-300 hover:text-red-500 transition-all"
                        title="Eliminar registro"
                      >
                        <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l1 14h10l1-14" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filasFiltradas.length > 0 && (
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td colSpan={4} className="py-3 px-4 text-gray-800">TOTAL ({filasFiltradas.length})</td>
                  <td className="py-3 px-4 text-right text-gray-800">
                    {Math.round(totalCosto).toLocaleString('es-CL')}
                  </td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filasFiltradas.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 px-2 text-sm text-gray-600 flex-shrink-0 border-t border-gray-200">
          <span>{pagina * FILAS_POR_PAGINA + 1}–{Math.min((pagina + 1) * FILAS_POR_PAGINA, filasFiltradas.length)} de {filasFiltradas.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPagina(p => p + 1)} disabled={(pagina + 1) * FILAS_POR_PAGINA >= filasFiltradas.length}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}

      {/* MODAL AGREGAR */}
      {modalAgregar && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setModalAgregar(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-5">Agregar registro</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador <span className="text-red-500">*</span></label>
              <input
                type="text"
                list="list-cols"
                value={formAgregar.colaborador}
                onChange={e => setFormAgregar(f => ({ ...f, colaborador: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Nombre del colaborador"
                autoFocus
              />
              <datalist id="list-cols">
                {[...colaboradoresSet].sort().map(c => <option key={c} value={c} />)}
              </datalist>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo Mes</label>
              <input
                type="number"
                min="0"
                value={formAgregar.costo_mes}
                onChange={e => setFormAgregar(f => ({ ...f, costo_mes: e.target.value }))}
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
