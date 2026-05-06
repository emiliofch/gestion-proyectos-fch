import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import ResizableTh from './ResizableTh'
import FilterableTh from './FilterableTh'

const HORAS_PROY_PATH = '/horas_proyectadas_deskflow.xlsx'

function buildTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/\..+/, '').replace(/:/g, '-')
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export default function VistaColaboradores({ perfil }) {
  const esAdmin = perfil?.rol === 'admin'

  const [colaboradores, setColaboradores] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('colaborador')
  const [ordenDir, setOrdenDir] = useState('asc')
  const [modalEditar, setModalEditar] = useState(null)
  const [formEdit, setFormEdit] = useState({ colaborador: '', rut: '', costo_empresa: '' })
  const [modalCrear, setModalCrear] = useState(false)
  const [formCrear, setFormCrear] = useState({ colaborador: '', rut: '', costo_empresa: '' })
  const [enHorasProy, setEnHorasProy] = useState(new Set())

  useEffect(() => {
    cargarColaboradores()
    cargarHorasProyectadas()
  }, [])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  async function cargarHorasProyectadas() {
    try {
      const PAGE = 1000
      let todas = [], from = 0
      while (true) {
        const { data } = await supabase.from('horas_proyectadas').select('colaborador').range(from, from + PAGE - 1)
        if (!data?.length) break
        todas = [...todas, ...data]
        if (data.length < PAGE) break
        from += PAGE
      }
      const nombres = new Set(todas.map(r => normalizeKey(String(r.colaborador ?? ''))).filter(Boolean))
      setEnHorasProy(nombres)
    } catch (_) {}
  }

  async function cargarColaboradores() {
    setLoading(true)
    const { data, error } = await supabase
      .from('colaboradores')
      .select('*')
      .order('colaborador', { ascending: true })

    if (error) {
      console.error('Error cargando colaboradores:', error)
    } else {
      setColaboradores(data || [])
    }
    setLoading(false)
  }

  async function crearColaborador() {
    if (!formCrear.colaborador.trim()) {
      toast.error('El nombre del colaborador es requerido')
      return
    }

    const registro = {
      colaborador: formCrear.colaborador.trim(),
      rut: formCrear.rut.trim() || null,
      costo_empresa: formCrear.costo_empresa !== '' ? parseFloat(String(formCrear.costo_empresa).replace(',', '.')) || null : null,
    }

    const { error } = await supabase.from('colaboradores').insert(registro)
    if (error) {
      toast.error('Error al crear: ' + error.message)
    } else {
      toast.success('Colaborador creado')
      setModalCrear(false)
      setFormCrear({ colaborador: '', rut: '', costo_empresa: '' })
      cargarColaboradores()
    }
  }

  async function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''

    setProcesando(true)
    const reader = new FileReader()

    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const filas = XLSX.utils.sheet_to_json(ws, { header: 1 })

        if (filas.length < 2) {
          toast.error('El archivo no tiene datos.')
          setProcesando(false)
          return
        }

        const headers = filas[0].map(h => String(h).trim().toUpperCase())
        const idxColaborador = headers.indexOf('COLABORADOR')
        const idxRut = headers.indexOf('RUT')
        const idxCosto = headers.indexOf('COSTO EMPRESA')

        if (idxColaborador === -1 || idxRut === -1) {
          toast.error('El Excel debe tener las columnas: COLABORADOR, RUT')
          setProcesando(false)
          return
        }

        const registros = []
        const errores = []

        for (let i = 1; i < filas.length; i++) {
          const fila = filas[i]
          const colaborador = String(fila[idxColaborador] ?? '').trim()
          const rut = String(fila[idxRut] ?? '').trim()
          const costoRaw = idxCosto >= 0 ? fila[idxCosto] : undefined
          const costo_empresa = costoRaw !== undefined && costoRaw !== '' && costoRaw !== null
            ? parseFloat(String(costoRaw).replace(',', '.')) || null
            : null

          if (!colaborador) {
            errores.push(`Fila ${i + 1}: COLABORADOR vacío`)
            continue
          }

          registros.push({ colaborador, rut, costo_empresa })
        }

        let insertados = 0
        let erroresInsert = 0

        for (const reg of registros) {
          const { error } = await supabase.from('colaboradores').insert(reg)
          if (error) erroresInsert++
          else insertados++
        }

        if (errores.length > 0) console.warn('Filas omitidas:', errores)

        toast.success(`Importación: ✓ ${insertados} colaboradores ✗ ${erroresInsert} errores`)
        cargarColaboradores()
      } catch (error) {
        toast.error('Error al leer el archivo: ' + error.message)
        console.error('❌ Error importación:', error)
      }
      setProcesando(false)
    }

    reader.readAsBinaryString(file)
  }

  function exportarExcel() {
    const datos = filtrados.map(c => ({
      COLABORADOR: c.colaborador,
      RUT: c.rut || '',
      'COSTO EMPRESA': c.costo_empresa ?? '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datos)
    XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores')
    XLSX.writeFile(wb, `colaboradores_${buildTimestamp()}.xlsx`)
  }

  function abrirEditar(c) {
    setFormEdit({ colaborador: c.colaborador, rut: c.rut || '', costo_empresa: c.costo_empresa ?? '' })
    setModalEditar(c)
  }

  async function guardarEdicion() {
    if (!formEdit.colaborador.trim()) {
      toast.error('El nombre del colaborador es requerido')
      return
    }

    const { error } = await supabase
      .from('colaboradores')
      .update({
        colaborador: formEdit.colaborador.trim(),
        rut: formEdit.rut.trim() || null,
        costo_empresa: formEdit.costo_empresa !== '' ? parseFloat(String(formEdit.costo_empresa).replace(',', '.')) || null : null,
      })
      .eq('id', modalEditar.id)

    if (error) {
      toast.error('Error al actualizar: ' + error.message)
    } else {
      toast.success('Colaborador actualizado')
      setModalEditar(null)
      cargarColaboradores()
    }
  }

  async function eliminarColaborador(id) {
    const { error } = await supabase.from('colaboradores').delete().eq('id', id)
    if (error) {
      toast.error('Error al eliminar: ' + error.message)
    } else {
      toast.success('Colaborador eliminado')
      setColaboradores(prev => prev.filter(c => c.id !== id))
    }
  }

  async function eliminarTodos() {
    if (!window.confirm('¿Seguro que deseas eliminar TODOS los colaboradores? Esta acción no se puede deshacer.')) return
    if (!window.confirm('Confirma nuevamente: se eliminarán TODOS los colaboradores.')) return

    setProcesando(true)
    const { error } = await supabase.from('colaboradores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      toast.success('Todos los colaboradores fueron eliminados')
      setColaboradores([])
    }
    setProcesando(false)
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

  const colaboradoresBusqueda = colaboradores.filter(c =>
    c.colaborador?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.rut?.toLowerCase().includes(busqueda.toLowerCase())
  )

  function coincideFiltros(c, omitirCol = null) {
    if (omitirCol !== 'colaborador' && filtros.colaborador?.length && !filtros.colaborador.includes(c.colaborador)) return false
    if (omitirCol !== 'rut' && filtros.rut?.length && !filtros.rut.includes(c.rut)) return false
    if (omitirCol !== 'enHorasProy' && filtros.enHorasProy?.length) {
      const val = enHorasProy.has(normalizeKey(c.colaborador)) ? 'Sí' : 'No'
      if (!filtros.enHorasProy.includes(val)) return false
    }
    return true
  }

  function opcionesPorColumna(col, obtenerValor) {
    const visibles = colaboradoresBusqueda.filter((c) => coincideFiltros(c, col))
    const base = visibles.map(obtenerValor).filter(Boolean)
    const seleccionadas = Array.isArray(filtros[col]) ? filtros[col] : []
    return [...new Set([...base, ...seleccionadas])].sort((a, b) => String(a).localeCompare(String(b), 'es'))
  }

  const opcionesColaborador = opcionesPorColumna('colaborador', (c) => c.colaborador)
  const opcionesRut = opcionesPorColumna('rut', (c) => c.rut)
  const opcionesEnHorasProy = [...new Set(
    colaboradoresBusqueda.filter(c => coincideFiltros(c, 'enHorasProy'))
      .map(c => enHorasProy.has(normalizeKey(c.colaborador)) ? 'Sí' : 'No')
  )].sort()

  const filtrados = colaboradoresBusqueda.filter((c) => coincideFiltros(c)).sort((a, b) => {
    const vA = ordenCol === 'rut' ? (a.rut || '') : (a.colaborador || '')
    const vB = ordenCol === 'rut' ? (b.rut || '') : (b.colaborador || '')
    return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
  })

  function formatCosto(val) {
    if (val === null || val === undefined || val === '') return '-'
    return Number(val).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      {/* Encabezado */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Colaboradores</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />

          <button
            onClick={() => { setFormCrear({ colaborador: '', rut: '', costo_empresa: '' }); setModalCrear(true) }}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: '#3B82F6' }}
          >
            + Agregar colaborador
          </button>

          <label
            className="px-4 py-2 rounded-lg text-white text-sm font-medium cursor-pointer transition-all hover:opacity-90"
            style={{ backgroundColor: procesando ? '#ccc' : '#FF5100' }}
            title="Columnas requeridas: COLABORADOR | RUT"
          >
            {procesando ? 'Importando...' : '⬆ Importar Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={importarExcel}
              disabled={procesando}
            />
          </label>

          <button
            onClick={exportarExcel}
            disabled={filtrados.length === 0}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#10B981' }}
          >
            ⬇ Exportar Excel
          </button>

          {esAdmin && colaboradores.length > 0 && (
            <button
              onClick={eliminarTodos}
              disabled={procesando}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90 bg-red-500"
            >
              🗑 Eliminar todos
            </button>
          )}
        </div>
      </div>

      {/* Formato Excel — siempre visible */}
      <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50 flex flex-wrap items-center gap-3 text-sm text-gray-700">
        <span className="font-semibold text-blue-700">Formato Excel:</span>
        <span className="font-mono bg-white border border-blue-200 rounded px-2 py-0.5 text-blue-800 font-bold">COLABORADOR</span>
        <span className="text-gray-400">|</span>
        <span className="font-mono bg-white border border-blue-200 rounded px-2 py-0.5 text-blue-800 font-bold">RUT</span>
        <span className="text-gray-400">|</span>
        <span className="font-mono bg-white border border-blue-200 rounded px-2 py-0.5 text-blue-800 font-bold">COSTO EMPRESA</span>
        <span className="text-gray-500 text-xs">(COLABORADOR es obligatorio · RUT y COSTO EMPRESA son opcionales)</span>
      </div>

      {/* Conteo */}
      <p className="text-sm text-gray-500 mb-4">
        {filtrados.length} colaborador{filtrados.length !== 1 ? 'es' : ''}
        {busqueda && ` para "${busqueda}"`}
      </p>

      <div className="flex-1 overflow-auto min-h-0">
      {loading ? (
        <p className="text-gray-500 text-center py-8">Cargando...</p>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg mb-2">No hay colaboradores registrados</p>
          <p className="text-gray-400 text-sm">Importa un Excel con columnas COLABORADOR y RUT</p>
        </div>
      ) : (
        <div>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '50px' }}>#</ResizableTh>
                <FilterableTh
                  col="colaborador"
                  label="Colaborador"
                  opciones={opcionesColaborador}
                  filtro={filtros.colaborador || ''}
                  onFiltro={setFiltro}
                  dropdownAbierto={dropdownFiltro === 'colaborador'}
                  onToggleDropdown={setDropdownFiltro}
                  sortable
                  ordenActiva={ordenCol === 'colaborador'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="rut"
                  label="RUT"
                  style={{ width: '160px' }}
                  opciones={opcionesRut}
                  filtro={filtros.rut || ''}
                  onFiltro={setFiltro}
                  dropdownAbierto={dropdownFiltro === 'rut'}
                  onToggleDropdown={setDropdownFiltro}
                  sortable
                  ordenActiva={ordenCol === 'rut'}
                  ordenDir={ordenDir}
                  onOrdenar={toggleOrden}
                />
                <FilterableTh
                  col="enHorasProy"
                  label="En Horas Proyectadas"
                  align="center"
                  style={{ width: '150px' }}
                  opciones={opcionesEnHorasProy}
                  filtro={filtros.enHorasProy || ''}
                  onFiltro={setFiltro}
                  dropdownAbierto={dropdownFiltro === 'enHorasProy'}
                  onToggleDropdown={setDropdownFiltro}
                />
                <ResizableTh className="text-right py-3 px-4 text-gray-800 font-semibold" style={{ width: '160px' }}>
                  Costo Empresa
                </ResizableTh>
                {esAdmin && (
                  <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '140px' }}>Acciones</ResizableTh>
                )}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c, i) => (
                <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-3 px-4 text-gray-500 text-sm">{i + 1}</td>
                  <td className="py-3 px-4 text-gray-800 font-medium">{c.colaborador}</td>
                  <td className="py-3 px-4 text-gray-600">{c.rut || '-'}</td>
                  <td className="py-3 px-2 text-center">
                    {enHorasProy.has(normalizeKey(c.colaborador))
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Sí</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">✗ No</span>
                    }
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-right">{formatCosto(c.costo_empresa)}</td>
                  {esAdmin && (
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => abrirEditar(c)}
                          className="px-3 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-all"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarColaborador(c.id)}
                          className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-all"
                          title="Eliminar colaborador"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Modal Crear */}
      {modalCrear && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Agregar Colaborador</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador *</label>
              <input
                type="text"
                value={formCrear.colaborador}
                onChange={e => setFormCrear({ ...formCrear, colaborador: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">RUT <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="text"
                value={formCrear.rut}
                onChange={e => setFormCrear({ ...formCrear, rut: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: 12.345.678-9"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo Empresa <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="number"
                step="any"
                value={formCrear.costo_empresa}
                onChange={e => setFormCrear({ ...formCrear, costo_empresa: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: 1500000"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModalCrear(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={crearColaborador}
                className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#FF5100' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Editar Colaborador</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador *</label>
              <input
                type="text"
                value={formEdit.colaborador}
                onChange={e => setFormEdit({ ...formEdit, colaborador: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
              <input
                type="text"
                value={formEdit.rut}
                onChange={e => setFormEdit({ ...formEdit, rut: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: 12.345.678-9"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo Empresa</label>
              <input
                type="number"
                step="any"
                value={formEdit.costo_empresa}
                onChange={e => setFormEdit({ ...formEdit, costo_empresa: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: 1500000"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModalEditar(null)}
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
