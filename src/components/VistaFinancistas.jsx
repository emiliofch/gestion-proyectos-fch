import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import FilterableTh from './FilterableTh'
import ResizableTh from './ResizableTh'

function buildTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

export default function VistaFinancistas({ perfil }) {
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('nombre')
  const [ordenDir, setOrdenDir] = useState('asc')
  const [modalAgregar, setModalAgregar] = useState(false)
  const [form, setForm] = useState({ nombre: '', tipo: '', industria: '' })

  const esAdmin = perfil?.rol === 'admin'

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('financistas').select('id, nombre, tipo, industria').order('nombre')
    if (error) toast.error('Error al cargar: ' + error.message)
    else setFilas(data || [])
    setLoading(false)
  }

  async function guardarCelda(id, col, valor) {
    const val = valor.trim() || null
    const { error } = await supabase.from('financistas').update({ [col]: val }).eq('id', id)
    if (error) { toast.error('Error al guardar: ' + error.message); return }
    setFilas(prev => prev.map(f => f.id === id ? { ...f, [col]: val } : f))
  }

  async function confirmarAgregar() {
    const nombre = form.nombre.trim()
    if (!nombre) { toast.error('El nombre es obligatorio'); return }
    setProcesando(true)
    const { data, error } = await supabase
      .from('financistas')
      .insert({ nombre, tipo: form.tipo.trim() || null, industria: form.industria.trim() || null })
      .select().single()
    if (error) { toast.error('Error al agregar: ' + error.message) }
    else {
      setFilas(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
      setModalAgregar(false)
      setForm({ nombre: '', tipo: '', industria: '' })
      toast.success('Financista agregado')
    }
    setProcesando(false)
  }

  async function eliminar(id, nombre) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    const { error } = await supabase.from('financistas').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar: ' + error.message); return }
    setFilas(prev => prev.filter(f => f.id !== id))
    toast.success('Eliminado')
  }

  function toggleOrden(col) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
  }

  function setFiltro(col, valor) { setFiltros(prev => ({ ...prev, [col]: valor })) }

  const filasFiltradas = filas
    .filter(f => {
      const q = busqueda.toLowerCase()
      const matchBusqueda = !q || [f.nombre, f.tipo, f.industria].some(v => (v || '').toLowerCase().includes(q))
      const matchNombre   = !filtros.nombre?.length    || filtros.nombre.includes(f.nombre)
      const matchTipo     = !filtros.tipo?.length      || filtros.tipo.includes(f.tipo)
      const matchIndustria = !filtros.industria?.length || filtros.industria.includes(f.industria)
      return matchBusqueda && matchNombre && matchTipo && matchIndustria
    })
    .sort((a, b) => {
      const vA = (a[ordenCol] || '').toLowerCase()
      const vB = (b[ordenCol] || '').toLowerCase()
      return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
    })

  const opcionesPor = col => [...new Set(filas.map(f => f[col]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))

  async function importarExcel(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcesando(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
        const nuevas = data
          .map(r => ({
            nombre:    (r.NombreFinancista || r.nombre    || r.NOMBRE    || '').toString().trim(),
            tipo:      (r.NombreTipo       || r.tipo      || r.TIPO      || '').toString().trim() || null,
            industria: (r.NombreIndustria  || r.industria || r.INDUSTRIA || '').toString().trim() || null,
          }))
          .filter(r => r.nombre)

        if (nuevas.length === 0) { toast.error('No hay filas válidas'); setProcesando(false); return }

        await supabase.from('financistas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        const CHUNK = 200
        let insertados = 0
        for (let i = 0; i < nuevas.length; i += CHUNK) {
          const { error } = await supabase.from('financistas').insert(nuevas.slice(i, i + CHUNK))
          if (!error) insertados += Math.min(CHUNK, nuevas.length - i)
        }
        toast.success(`Importación completada: ${insertados} financistas`)
        cargar()
      } catch (err) { toast.error('Error: ' + err.message) }
      setProcesando(false)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  function exportarExcel() {
    const rows = filasFiltradas.map(f => ({ NOMBRE: f.nombre, TIPO: f.tipo || '', INDUSTRIA: f.industria || '' }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Financistas')
    XLSX.writeFile(wb, `financistas_${buildTimestamp()}.xlsx`)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Financistas</h2>
        <div className="flex gap-2 flex-wrap items-center">
          {esAdmin && (
            <button
              onClick={() => { setForm({ nombre: '', tipo: '', industria: '' }); setModalAgregar(true) }}
              className="px-4 py-2 rounded-lg text-white font-medium hover:opacity-90"
              style={{ backgroundColor: '#FF5100' }}
            >
              + Agregar
            </button>
          )}
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={exportarExcel}
            disabled={filasFiltradas.length === 0}
            className="px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#6366F1' }}
          >
            Exportar Excel
          </button>
          {esAdmin && (
            <label className="px-4 py-2 rounded-lg text-white font-medium cursor-pointer hover:opacity-90" style={{ backgroundColor: '#10B981' }}>
              Importar Excel
              <input type="file" accept=".xlsx,.xls" onChange={importarExcel} className="hidden" />
            </label>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
                <ResizableTh className="py-3 px-3 text-gray-500 font-semibold text-center bg-[#FFF5F0]" style={{ width: '48px' }}>#</ResizableTh>
                <FilterableTh col="nombre" label="Financista" align="left"
                  opciones={opcionesPor('nombre')} filtro={filtros.nombre || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'nombre'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'nombre'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="tipo" label="Tipo" align="left"
                  opciones={opcionesPor('tipo')} filtro={filtros.tipo || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'tipo'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'tipo'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                <FilterableTh col="industria" label="Industria" align="left"
                  opciones={opcionesPor('industria')} filtro={filtros.industria || []}
                  onFiltro={setFiltro} dropdownAbierto={dropdownFiltro === 'industria'} onToggleDropdown={setDropdownFiltro}
                  sortable ordenActiva={ordenCol === 'industria'} ordenDir={ordenDir} onOrdenar={toggleOrden} />
                {esAdmin && <ResizableTh className="bg-[#FFF5F0]" style={{ width: '42px' }} />}
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Sin resultados.</td></tr>
              ) : filasFiltradas.map((f, idx) => (
                <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50 transition-all">
                  <td className="py-2 px-3 text-gray-400 text-sm text-center">{idx + 1}</td>
                  <td className="py-2 px-2">
                    {esAdmin ? (
                      <input type="text" defaultValue={f.nombre} key={f.id + '_n'}
                        onBlur={e => guardarCelda(f.id, 'nombre', e.target.value)}
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-sm" />
                    ) : <span className="text-sm px-1">{f.nombre}</span>}
                  </td>
                  <td className="py-2 px-2">
                    {esAdmin ? (
                      <input type="text" defaultValue={f.tipo || ''} key={f.id + '_t'}
                        onBlur={e => guardarCelda(f.id, 'tipo', e.target.value)}
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-sm" />
                    ) : <span className="text-sm px-1">{f.tipo || <span className="text-gray-300">—</span>}</span>}
                  </td>
                  <td className="py-2 px-2">
                    {esAdmin ? (
                      <input type="text" defaultValue={f.industria || ''} key={f.id + '_i'}
                        onBlur={e => guardarCelda(f.id, 'industria', e.target.value)}
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-sm" />
                    ) : <span className="text-sm px-1">{f.industria || <span className="text-gray-300">—</span>}</span>}
                  </td>
                  {esAdmin && (
                    <td className="py-2 px-2 text-center">
                      <button onClick={() => eliminar(f.id, f.nombre)} className="text-gray-300 hover:text-red-500 transition-all" title="Eliminar">
                        <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filasFiltradas.length > 0 && (
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td colSpan={esAdmin ? 5 : 4} className="py-3 px-4 text-gray-800 text-sm">
                    TOTAL: {filasFiltradas.length} de {filas.length}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modalAgregar && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setModalAgregar(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-5">Agregar financista</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Nombre del financista" autoFocus />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <input type="text" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Ej: Público, Privado, Internacional" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Industria</label>
              <input type="text" value={form.industria} onChange={e => setForm(f => ({ ...f, industria: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Ej: Minería, Energía, Salud" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModalAgregar(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={confirmarAgregar} disabled={procesando}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#FF5100' }}>
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
