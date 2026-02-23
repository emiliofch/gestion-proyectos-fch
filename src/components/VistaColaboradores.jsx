import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import ResizableTh from './ResizableTh'

export default function VistaColaboradores({ user, perfil }) {
  const esAdmin = perfil?.rol === 'admin'

  const [colaboradores, setColaboradores] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [modalEditar, setModalEditar] = useState(null)   // colaborador a editar
  const [formEdit, setFormEdit] = useState({ colaborador: '', rut: '' })

  useEffect(() => {
    cargarColaboradores()
  }, [])

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

          if (!colaborador) {
            errores.push(`Fila ${i + 1}: COLABORADOR vacío`)
            continue
          }

          registros.push({ colaborador, rut })
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

  function abrirEditar(c) {
    setFormEdit({ colaborador: c.colaborador, rut: c.rut || '' })
    setModalEditar(c)
  }

  async function guardarEdicion() {
    if (!formEdit.colaborador.trim()) {
      toast.error('El nombre del colaborador es requerido')
      return
    }

    const { error } = await supabase
      .from('colaboradores')
      .update({ colaborador: formEdit.colaborador.trim(), rut: formEdit.rut.trim() || null })
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

  const filtrados = colaboradores.filter(c =>
    c.colaborador?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.rut?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
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
        <span className="text-gray-500 text-xs">(COLABORADOR es obligatorio · RUT es opcional)</span>
      </div>

      {/* Conteo */}
      <p className="text-sm text-gray-500 mb-4">
        {filtrados.length} colaborador{filtrados.length !== 1 ? 'es' : ''}
        {busqueda && ` para "${busqueda}"`}
      </p>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Cargando...</p>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg mb-2">No hay colaboradores registrados</p>
          <p className="text-gray-400 text-sm">Importa un Excel con columnas COLABORADOR y RUT</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '50px' }}>#</ResizableTh>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold">Colaborador</ResizableTh>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '160px' }}>RUT</ResizableTh>
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

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
              <input
                type="text"
                value={formEdit.rut}
                onChange={e => setFormEdit({ ...formEdit, rut: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: 12.345.678-9"
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
