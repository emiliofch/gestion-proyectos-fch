import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import ResizableTh from './ResizableTh'

const ESTADOS = ['Activo', 'En pausa', 'Terminado', 'Cancelado']

function badgeRendible(rendible) {
  if (rendible === true)  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Sí</span>
  if (rendible === false) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">No</span>
  return <span className="text-gray-400 text-xs italic">-</span>
}

function badgeEstado(estado) {
  if (!estado) return <span className="text-gray-400 text-xs italic">-</span>
  const colores = {
    'Activo':    'bg-green-100 text-green-800',
    'En pausa':  'bg-yellow-100 text-yellow-800',
    'Terminado': 'bg-blue-100 text-blue-800',
    'Cancelado': 'bg-red-100 text-red-800',
  }
  const cls = colores[estado] || 'bg-gray-100 text-gray-700'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{estado}</span>
}

export default function VistaProyectosBase({ user, perfil }) {
  const esAdmin = perfil?.rol === 'admin'

  const [proyectos, setProyectos] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [eliminandoTodos, setEliminandoTodos] = useState(false)
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false)

  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [formData, setFormData] = useState({ nombre: '', ceco: '', estado: '', tipo: '', rendible: '', ceco_codigo: '', jefe_id: '' })
  const [motivoCambio, setMotivoCambio] = useState('')

  useEffect(() => {
    cargarColaboradores()
    cargarProyectos()
  }, [])

  async function cargarColaboradores() {
    const { data } = await supabase
      .from('colaboradores')
      .select('id, colaborador')
      .order('colaborador', { ascending: true })
    setColaboradores(data || [])
  }

  async function cargarProyectos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('proyectos')
      .select('*, colaboradores:jefe_id(id, colaborador)')
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
          const estado      = row.ESTADO    || row.estado    || ''
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
              estado:      estado.trim()      || null,
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
    const filas = proyectosFiltrados.map((p, i) => ({
      '#':        i + 1,
      PROYECTO:   p.nombre,
      LINEA:      p.ceco || '',
      JEFE:       p.colaboradores?.colaborador || '',
      ESTADO:     p.estado || '',
      TIPO:       p.tipo || '',
      RENDIBLE:   p.rendible === true ? 'Sí' : p.rendible === false ? 'No' : '',
      CECO:       p.ceco_codigo || '',
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Proyectos')
    XLSX.writeFile(wb, 'proyectos.xlsx')
  }

  async function eliminarTodos() {
    const confirm1 = window.confirm(
      `¿Eliminar TODOS los ${proyectos.length} proyectos?\n\nEsta acción también eliminará todas las oportunidades asociadas y no se puede deshacer.`
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
    setFormData({ nombre: '', ceco: '', estado: '', tipo: '', rendible: '', ceco_codigo: '', jefe_id: '' })
    setModalCrear(true)
  }

  async function crearProyecto() {
    if (!formData.nombre.trim()) { toast.error('El nombre del proyecto es requerido'); return }
    if (!formData.ceco.trim())   { toast.error('La línea es requerida'); return }

    const { data: nuevoProyecto, error } = await supabase
      .from('proyectos')
      .insert({
        nombre:      formData.nombre.trim(),
        ceco:        formData.ceco.trim(),
        estado:      formData.estado          || null,
        tipo:        formData.tipo.trim()     || null,
        rendible:    parseRendible(formData.rendible),
        ceco_codigo: formData.ceco_codigo.trim() || null,
        jefe_id:     formData.jefe_id         || null
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
      estado:      proyecto.estado       || '',
      tipo:        proyecto.tipo         || '',
      rendible:    rendibleToString(proyecto.rendible),
      ceco_codigo: proyecto.ceco_codigo  || '',
      jefe_id:     proyecto.jefe_id      || ''
    })
    setMotivoCambio('')
    setModalEditar(proyecto)
  }

  async function guardarEdicion() {
    if (!modalEditar) return
    if (!formData.nombre.trim()) { toast.error('El nombre del proyecto es requerido'); return }
    if (!formData.ceco.trim())   { toast.error('La línea es requerida'); return }
    if (!motivoCambio.trim())    { toast.error('Debes ingresar un motivo para el cambio'); return }

    const cambiosList = []

    if (modalEditar.nombre !== formData.nombre.trim())
      cambiosList.push({ campo: 'NOMBRE',   anterior: modalEditar.nombre,           nuevo: formData.nombre.trim() })
    if (modalEditar.ceco !== formData.ceco.trim())
      cambiosList.push({ campo: 'LINEA',    anterior: modalEditar.ceco,             nuevo: formData.ceco.trim() })
    if ((modalEditar.estado || '') !== (formData.estado || ''))
      cambiosList.push({ campo: 'ESTADO',   anterior: modalEditar.estado || '',     nuevo: formData.estado || '' })
    if ((modalEditar.tipo || '') !== formData.tipo.trim())
      cambiosList.push({ campo: 'TIPO',     anterior: modalEditar.tipo || '',       nuevo: formData.tipo.trim() })
    if (rendibleToString(modalEditar.rendible) !== formData.rendible)
      cambiosList.push({ campo: 'RENDIBLE', anterior: rendibleToString(modalEditar.rendible), nuevo: formData.rendible })
    if ((modalEditar.ceco_codigo || '') !== formData.ceco_codigo.trim())
      cambiosList.push({ campo: 'CECO',     anterior: modalEditar.ceco_codigo || '', nuevo: formData.ceco_codigo.trim() })
    if ((modalEditar.jefe_id || '') !== (formData.jefe_id || '')) {
      const anterior = colaboradores.find(c => c.id === modalEditar.jefe_id)?.colaborador || '-'
      const nuevo    = colaboradores.find(c => c.id === formData.jefe_id)?.colaborador    || '-'
      cambiosList.push({ campo: 'JEFE', anterior, nuevo })
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
        estado:      formData.estado          || null,
        tipo:        formData.tipo.trim()     || null,
        rendible:    parseRendible(formData.rendible),
        ceco_codigo: formData.ceco_codigo.trim() || null,
        jefe_id:     formData.jefe_id         || null
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
    if (!confirm(`¿Eliminar el proyecto "${proyecto.nombre}"?\n\nEsto también eliminará todas las oportunidades asociadas.`)) return

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

  const proyectosFiltrados = proyectos.filter(p => {
    const q = busqueda.toLowerCase()
    return (
      p.nombre?.toLowerCase().includes(q) ||
      p.ceco?.toLowerCase().includes(q) ||
      p.estado?.toLowerCase().includes(q) ||
      p.tipo?.toLowerCase().includes(q) ||
      p.colaboradores?.colaborador?.toLowerCase().includes(q)
    )
  })

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

  return (
    <div>
      {/* Cabecera */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Proyectos</h2>
        <div className="flex gap-2 flex-wrap items-center">
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
          <label
            className={`px-4 py-2 rounded-lg text-white font-medium transition-all cursor-pointer hover:opacity-90 ${procesando ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: '#10B981' }}
          >
            {procesando ? 'Procesando...' : 'Importar Excel'}
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
            <li>- <strong>ESTADO</strong>: Activo, En pausa, Terminado, Cancelado (opcional)</li>
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
          Aquí puedes gestionar los proyectos base. Las oportunidades se crean en la sección <strong>Oportunidades</strong>.
        </p>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando proyectos...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '48px' }}>#</ResizableTh>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '140px' }}>Línea</ResizableTh>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold">Proyecto</ResizableTh>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '150px' }}>Jefe</ResizableTh>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '110px' }}>Estado</ResizableTh>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '110px' }}>Tipo</ResizableTh>
                <ResizableTh className="text-center py-3 px-4 text-gray-800 font-semibold" style={{ width: '95px' }}>Rendible</ResizableTh>
                <ResizableTh className="text-left py-3 px-4 text-gray-800 font-semibold" style={{ width: '95px' }}>CECO</ResizableTh>
                <ResizableTh className="text-center py-3 px-4 text-gray-800 font-semibold" style={{ width: '130px' }}>Acciones</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {proyectosFiltrados.map((p, index) => (
                <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-3 px-4 text-gray-500 text-sm">{index + 1}</td>
                  <td className="py-3 px-4 text-gray-600 text-sm max-w-xs truncate" title={p.ceco}>{p.ceco}</td>
                  <td className="py-3 px-4 text-gray-800 font-medium">{p.nombre}</td>
                  <td className="py-3 px-4 text-gray-700 text-sm">
                    {p.colaboradores?.colaborador || <span className="text-gray-400 italic">-</span>}
                  </td>
                  <td className="py-3 px-4">{badgeEstado(p.estado)}</td>
                  <td className="py-3 px-4 text-gray-600 text-sm">{p.tipo || <span className="text-gray-400 italic">-</span>}</td>
                  <td className="py-3 px-4 text-center">{badgeRendible(p.rendible)}</td>
                  <td className="py-3 px-4 text-gray-600 text-sm">{p.ceco_codigo || <span className="text-gray-400 italic">-</span>}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => abrirModalEditar(p)}
                        className="px-3 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all text-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarProyecto(p)}
                        className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all text-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {proyectosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    {busqueda ? 'No hay proyectos que coincidan con la búsqueda' : 'No hay proyectos cargados'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
              <input type="text" value={formData.ceco}
                onChange={(e) => setFormData({ ...formData, ceco: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: Chileglobal Ventures" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Jefe de Proyecto</label>
              <SelectJefe value={formData.jefe_id} onChange={(e) => setFormData({ ...formData, jefe_id: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Sin definir</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <input type="text" value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: Consultoría, Investigación..." />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rendible</label>
              <select value={formData.rendible} onChange={(e) => setFormData({ ...formData, rendible: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Sin definir</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">CECO</label>
              <input type="text" value={formData.ceco_codigo}
                onChange={(e) => setFormData({ ...formData, ceco_codigo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Código de centro de costo (opcional)" />
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
              <input type="text" value={formData.ceco}
                onChange={(e) => setFormData({ ...formData, ceco: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Jefe de Proyecto</label>
              <SelectJefe value={formData.jefe_id} onChange={(e) => setFormData({ ...formData, jefe_id: e.target.value })} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Sin definir</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <input type="text" value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: Consultoría, Investigación..." />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rendible</label>
              <select value={formData.rendible} onChange={(e) => setFormData({ ...formData, rendible: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Sin definir</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">CECO</label>
              <input type="text" value={formData.ceco_codigo}
                onChange={(e) => setFormData({ ...formData, ceco_codigo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Código de centro de costo (opcional)" />
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
