import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import FilterableTh from './FilterableTh'
import ResizableTh from './ResizableTh'

function buildTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

function normalizarCeco(raw) {
  const value = String(raw || '').trim()
  return value || null
}

function esEncabezadoCeco(valor) {
  const txt = String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return ['ceco', 'centro de costo', 'centro costo', 'linea'].includes(txt)
}

export default function VistaCentrosCosto({ perfil }) {
  const [centros, setCentros] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('ceco')
  const [ordenDir, setOrdenDir] = useState('asc')
  const [pagina, setPagina] = useState(0)
  const FILAS_POR_PAGINA = 10
  const [modalAgregar, setModalAgregar] = useState(false)
  const [nuevoCeco, setNuevoCeco] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [editandoValor, setEditandoValor] = useState('')

  useEffect(() => {
    cargarCentros()
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  async function cargarCentros() {
    setLoading(true)
    let query = supabase
      .from('centros_costo')
      .select('id, ceco, empresa')
      .order('ceco', { ascending: true })
    if (perfil?.empresa) query = query.eq('empresa', perfil.empresa)

    const { data, error } = await query

    if (error) {
      toast.error('Error cargando centros de costo: ' + error.message)
      setCentros([])
    } else {
      setCentros(data || [])
    }
    setLoading(false)
  }

  async function importarExcel(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setProcesando(true)
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        const candidatos = rows
          .map((r) => normalizarCeco(Array.isArray(r) ? r[0] : null))
          .filter((v) => v && !esEncabezadoCeco(v))

        if (candidatos.length === 0) {
          toast.warning('El archivo no contiene valores en la primera columna')
          return
        }

        const unicos = [...new Set(candidatos)]
        const payload = unicos.map((ceco) => ({ ceco }))

        const { data: existentes } = await supabase
          .from('centros_costo')
          .select('ceco')
          .in('ceco', unicos)

        const existentesSet = new Set((existentes || []).map((r) => r.ceco))
        const nuevos = payload.filter((r) => !existentesSet.has(r.ceco))

        if (nuevos.length === 0) {
          toast.info('No hay nuevos centros de costo para importar')
          return
        }

        const { error } = await supabase.from('centros_costo').insert(nuevos)
        if (error) {
          toast.error('Error importando centros de costo: ' + error.message)
          return
        }

        toast.success(`Importación completada: ${nuevos.length} centro(s) de costo`)
        await cargarCentros()
      } catch (error) {
        toast.error('Error leyendo Excel: ' + error.message)
      } finally {
        setProcesando(false)
        e.target.value = ''
      }
    }

    reader.readAsBinaryString(file)
  }

  function exportarExcel() {
    const ws = XLSX.utils.json_to_sheet(centrosFiltrados.map((c) => ({ CECO: c.ceco })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'CentrosCosto')
    XLSX.writeFile(wb, `centros_costo_${buildTimestamp()}.xlsx`)
  }

  const centrosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return centros.filter((c) => {
      const matchBusqueda = !q || c.ceco?.toLowerCase().includes(q)
      const matchFiltro = !filtros.ceco?.length || filtros.ceco.includes(c.ceco)
      return matchBusqueda && matchFiltro
    }).sort((a, b) => {
      const aVal = a.ceco || ''
      const bVal = b.ceco || ''
      return ordenDir === 'asc'
        ? aVal.localeCompare(bVal, 'es')
        : bVal.localeCompare(aVal, 'es')
    })
  }, [centros, busqueda, filtros, ordenDir])

  const opcionesCeco = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const base = centros
      .filter((c) => !q || c.ceco?.toLowerCase().includes(q))
      .map((c) => c.ceco)
      .filter(Boolean)
    const seleccionadas = Array.isArray(filtros.ceco) ? filtros.ceco : []
    return [...new Set([...base, ...seleccionadas])].sort((a, b) => a.localeCompare(b, 'es'))
  }, [centros, busqueda, filtros.ceco])

  useEffect(() => { setPagina(0) }, [busqueda, filtros, ordenDir])

  function setFiltro(col, valor) {
    setFiltros((prev) => ({ ...prev, [col]: valor }))
  }

  async function agregarCeco() {
    const valor = nuevoCeco.trim()
    if (!valor) { toast.error('El nombre del CECO no puede estar vacío'); return }
    const { data: existe } = await supabase.from('centros_costo').select('id').eq('ceco', valor).maybeSingle()
    if (existe) { toast.warning('Ya existe un CECO con ese nombre'); return }
    const { error } = await supabase.from('centros_costo').insert({ ceco: valor })
    if (error) { toast.error('Error al agregar: ' + error.message); return }
    toast.success('CECO agregado')
    setNuevoCeco('')
    setModalAgregar(false)
    await cargarCentros()
  }

  async function guardarEdicion() {
    const valor = editandoValor.trim()
    const id = editandoId
    setEditandoId(null)
    setEditandoValor('')
    if (!valor) return
    const { data: existe } = await supabase.from('centros_costo').select('id').eq('ceco', valor).neq('id', id).maybeSingle()
    if (existe) { toast.warning('Ya existe un CECO con ese nombre'); return }
    const { error } = await supabase.from('centros_costo').update({ ceco: valor }).eq('id', id)
    if (error) { toast.error('Error al editar: ' + error.message); return }
    setCentros(prev => prev.map(c => c.id === id ? { ...c, ceco: valor } : c))
    toast.success('CECO actualizado')
  }

  function toggleOrden(col) {
    if (ordenCol === col) {
      setOrdenDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setOrdenCol(col)
      setOrdenDir('asc')
    }
  }

  return (
    <>
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Centros de Costo</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar CECO..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={exportarExcel}
            disabled={centrosFiltrados.length === 0}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#6366F1' }}
          >
            Exportar Excel
          </button>
          <button
            onClick={() => { setNuevoCeco(''); setModalAgregar(true) }}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: '#FF5100' }}
          >
            + Agregar
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
        </div>
      </div>

      <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-sm text-gray-600">
          Esta tabla alimenta el dropdown de <strong>Línea</strong> al crear/editar proyectos.
        </p>
        <p className="text-sm text-gray-700 mt-1">
          Formato de importación: el archivo Excel debe tener encabezado <strong>CECO</strong> en la columna A.
        </p>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando centros de costo...</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                <FilterableTh
                  col="ceco"
                  label="CECO"
                  opciones={opcionesCeco}
                  filtro={filtros.ceco || []}
                  onFiltro={setFiltro}
                  dropdownAbierto={dropdownFiltro === 'ceco'}
                  onToggleDropdown={setDropdownFiltro}
                  sortable
                  ordenActiva={ordenCol === 'ceco'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
                <ResizableTh className="bg-[#FFF5F0]" style={{ width: '48px' }} />
              </tr>
            </thead>
            <tbody>
              {centrosFiltrados.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA).map((c) => (
                <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-2 px-4 text-gray-800">
                    {editandoId === c.id ? (
                      <input
                        autoFocus
                        value={editandoValor}
                        onChange={e => setEditandoValor(e.target.value)}
                        onBlur={guardarEdicion}
                        onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(); if (e.key === 'Escape') { setEditandoId(null); setEditandoValor('') } }}
                        className="w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                      />
                    ) : (
                      c.ceco
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => { setEditandoId(c.id); setEditandoValor(c.ceco) }}
                      className="text-gray-300 hover:text-blue-500 transition-all"
                      title="Editar"
                    >
                      <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {centrosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-10 px-4 text-center text-gray-500">
                    No hay centros de costo cargados.
                  </td>
                </tr>
              )}
              {centrosFiltrados.length > 0 && (
                <tr className="border-t-2 border-gray-400 font-bold" style={{ backgroundColor: '#FFF5F0' }}>
                  <td colSpan={2} className="py-3 px-4 text-gray-800 text-sm">TOTAL: {centrosFiltrados.length} de {centros.length}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {!loading && centrosFiltrados.length > FILAS_POR_PAGINA && (
        <div className="flex justify-between items-center py-2 px-2 text-sm text-gray-600 flex-shrink-0 border-t border-gray-200">
          <span>{pagina * FILAS_POR_PAGINA + 1}–{Math.min((pagina + 1) * FILAS_POR_PAGINA, centrosFiltrados.length)} de {centrosFiltrados.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">← Anterior</button>
            <button onClick={() => setPagina(p => p + 1)} disabled={(pagina + 1) * FILAS_POR_PAGINA >= centrosFiltrados.length}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">Siguiente →</button>
          </div>
        </div>
      )}
    </div>

    {modalAgregar && (

      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Agregar Centro de Costo</h3>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre CECO <span className="text-red-500">*</span></label>
          <input
            autoFocus
            type="text"
            value={nuevoCeco}
            onChange={e => setNuevoCeco(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') agregarCeco(); if (e.key === 'Escape') setModalAgregar(false) }}
            placeholder="Ej: Proyectos Corporativos"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalAgregar(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={agregarCeco}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
              style={{ backgroundColor: '#FF5100' }}>
              Agregar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
