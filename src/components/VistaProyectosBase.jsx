import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'

export default function VistaProyectosBase({ user }) {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false)

  // Estado para modales
  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [formData, setFormData] = useState({ nombre: '', ceco: '', jefe: '' })
  const [motivoCambio, setMotivoCambio] = useState('')

  useEffect(() => {
    cargarProyectos()
  }, [])

  async function cargarProyectos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error cargando proyectos:', error)
    } else {
      setProyectos(data || [])
    }
    setLoading(false)
  }

  // IMPORTAR PROYECTOS DESDE EXCEL
  async function importarExcel(e) {
    const file = e.target.files[0]
    if (!file) return

    setProcesando(true)
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        console.log('=== INICIO IMPORTACIÓN PROYECTOS ===')
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet)

        console.log('Total filas:', data.length)
        console.log('Columnas:', Object.keys(data[0] || {}))

        let insertados = 0
        let errores = 0
        let duplicados = []

        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          const nombre = row.PROYECTO || row.proyecto || row.NOMBRE || row.nombre || ''
          const ceco = row.CECO || row.ceco || row['CENTRO DE COSTO'] || row['centro de costo'] || ''
          const jefe = row.JEFE || row.jefe || row['JEFE PROYECTO'] || row['jefe proyecto'] || null

          if (!nombre.trim() || !ceco.trim()) {
            errores++
            continue
          }

          // Verificar si ya existe
          const { data: existente } = await supabase
            .from('proyectos')
            .select('id')
            .eq('nombre', nombre.trim())
            .limit(1)

          if (existente && existente.length > 0) {
            duplicados.push(nombre)
            continue
          }

          // Insertar proyecto
          const { data: nuevoProyecto, error: errorInsert } = await supabase
            .from('proyectos')
            .insert({
              nombre: nombre.trim(),
              ceco: ceco.trim(),
              jefe: jefe?.trim() || null
            })
            .select()
            .single()

          if (errorInsert) {
            console.error('Error insert:', errorInsert)
            errores++
          } else {
            insertados++
            // Registrar en control de cambios
            await supabase.from('cambios').insert({
              proyecto_id: nuevoProyecto.id,
              campo: 'PROYECTO CREADO',
              valor_anterior: '',
              valor_nuevo: nombre.trim(),
              usuario: user?.email || 'sistema',
              motivo: 'Proyecto importado desde Excel',
              tipo_cambio: 'proyecto',
              proyecto_nombre: nombre.trim()
            })
          }
        }

        console.log('=== RESUMEN ===')
        console.log('Insertados:', insertados, 'Errores:', errores, 'Duplicados:', duplicados.length)

        if (duplicados.length > 0) {
          console.log('Duplicados:', duplicados)
          toast.warning(`${duplicados.length} proyectos ya existian`)
        }

        toast.success(`Importacion: ${insertados} proyectos creados`)
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

  // CREAR PROYECTO
  function abrirModalCrear() {
    setFormData({ nombre: '', ceco: '', jefe: '' })
    setModalCrear(true)
  }

  async function crearProyecto() {
    if (!formData.nombre.trim()) {
      toast.error('El nombre del proyecto es requerido')
      return
    }
    if (!formData.ceco.trim()) {
      toast.error('El centro de costo es requerido')
      return
    }

    const { data: nuevoProyecto, error } = await supabase
      .from('proyectos')
      .insert({
        nombre: formData.nombre.trim(),
        ceco: formData.ceco.trim(),
        jefe: formData.jefe.trim() || null
      })
      .select()
      .single()

    if (error) {
      toast.error('Error al crear proyecto: ' + error.message)
      return
    }

    // Registrar en control de cambios
    await supabase.from('cambios').insert({
      proyecto_id: nuevoProyecto.id,
      campo: 'PROYECTO CREADO',
      valor_anterior: '',
      valor_nuevo: formData.nombre.trim(),
      usuario: user?.email || 'sistema',
      motivo: 'Proyecto creado manualmente',
      tipo_cambio: 'proyecto',
      proyecto_nombre: formData.nombre.trim()
    })

    toast.success('Proyecto creado')
    setModalCrear(false)
    cargarProyectos()
  }

  // EDITAR PROYECTO
  function abrirModalEditar(proyecto) {
    setFormData({
      nombre: proyecto.nombre,
      ceco: proyecto.ceco,
      jefe: proyecto.jefe || ''
    })
    setMotivoCambio('')
    setModalEditar(proyecto)
  }

  async function guardarEdicion() {
    if (!modalEditar) return

    if (!formData.nombre.trim()) {
      toast.error('El nombre del proyecto es requerido')
      return
    }
    if (!formData.ceco.trim()) {
      toast.error('El centro de costo es requerido')
      return
    }
    if (!motivoCambio.trim()) {
      toast.error('Debes ingresar un motivo para el cambio')
      return
    }

    const cambios = []

    // Detectar qué cambió
    if (modalEditar.nombre !== formData.nombre.trim()) {
      cambios.push({ campo: 'NOMBRE', anterior: modalEditar.nombre, nuevo: formData.nombre.trim() })
    }
    if (modalEditar.ceco !== formData.ceco.trim()) {
      cambios.push({ campo: 'CECO', anterior: modalEditar.ceco, nuevo: formData.ceco.trim() })
    }
    if ((modalEditar.jefe || '') !== formData.jefe.trim()) {
      cambios.push({ campo: 'JEFE', anterior: modalEditar.jefe || '', nuevo: formData.jefe.trim() })
    }

    if (cambios.length === 0) {
      toast.info('No hay cambios para guardar')
      setModalEditar(null)
      return
    }

    // Actualizar proyecto
    const { error } = await supabase
      .from('proyectos')
      .update({
        nombre: formData.nombre.trim(),
        ceco: formData.ceco.trim(),
        jefe: formData.jefe.trim() || null
      })
      .eq('id', modalEditar.id)

    if (error) {
      toast.error('Error al actualizar: ' + error.message)
      return
    }

    // Registrar cada cambio
    for (const c of cambios) {
      await supabase.from('cambios').insert({
        proyecto_id: modalEditar.id,
        campo: c.campo,
        valor_anterior: c.anterior,
        valor_nuevo: c.nuevo,
        usuario: user?.email || 'sistema',
        motivo: motivoCambio,
        tipo_cambio: 'proyecto',
        proyecto_nombre: formData.nombre.trim()
      })
    }

    toast.success('Proyecto actualizado')
    setModalEditar(null)
    cargarProyectos()
  }

  // ELIMINAR PROYECTO
  async function eliminarProyecto(proyecto) {
    if (!confirm(`¿Eliminar el proyecto "${proyecto.nombre}"?\n\nEsto también eliminará todas las oportunidades asociadas.`)) return

    // Registrar eliminación antes de borrar
    await supabase.from('cambios').insert({
      proyecto_id: proyecto.id,
      campo: 'PROYECTO ELIMINADO',
      valor_anterior: proyecto.nombre,
      valor_nuevo: '',
      usuario: user?.email || 'sistema',
      motivo: 'Proyecto eliminado manualmente',
      tipo_cambio: 'proyecto',
      proyecto_nombre: proyecto.nombre
    })

    const { error } = await supabase
      .from('proyectos')
      .delete()
      .eq('id', proyecto.id)

    if (error) {
      toast.error('Error al eliminar: ' + error.message)
    } else {
      toast.success('Proyecto eliminado')
      cargarProyectos()
    }
  }

  const proyectosFiltrados = proyectos.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.ceco?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.jefe?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Proyectos</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar proyecto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={() => setMostrarInstrucciones(!mostrarInstrucciones)}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all"
            title="Ver formato de importacion Excel"
          >
            ?
          </button>
          <label
            className={`px-4 py-2 rounded-lg text-white font-medium transition-all cursor-pointer hover:opacity-90 ${procesando ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: '#10B981' }}
            title="Importar proyectos desde Excel"
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
            onClick={abrirModalCrear}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: '#FF5100' }}
          >
            + Nuevo Proyecto
          </button>
          <span className="text-sm text-gray-500">
            {proyectosFiltrados.length} de {proyectos.length} proyectos
          </span>
        </div>
      </div>

      {mostrarInstrucciones && (
        <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-300">
          <h3 className="font-bold text-gray-800 mb-2">Formato Excel para Importar Proyectos:</h3>
          <div className="bg-white p-3 rounded border border-yellow-200 font-mono text-sm mb-2">
            <span className="text-blue-600 font-bold">PROYECTO</span>
            <span className="text-gray-400 mx-2">|</span>
            <span className="text-green-600 font-bold">CECO</span>
            <span className="text-gray-400 mx-2">|</span>
            <span className="text-purple-600 font-bold">JEFE</span>
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>- <strong>PROYECTO</strong>: Nombre del proyecto (requerido)</li>
            <li>- <strong>CECO</strong>: Centro de costo (requerido)</li>
            <li>- <strong>JEFE</strong>: Jefe de proyecto (opcional)</li>
          </ul>
          <p className="text-xs text-gray-500 mt-2">Columnas alternativas aceptadas: NOMBRE, CENTRO DE COSTO, JEFE PROYECTO</p>
        </div>
      )}

      <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-sm text-gray-600">
          Aqui puedes gestionar los proyectos base. Haz click en un campo para editarlo. Las oportunidades se crean en la seccion <strong>Oportunidades</strong>.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando proyectos...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0' }}>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">#</th>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">Proyecto</th>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">Centro de Costo</th>
                <th className="text-left py-3 px-4 text-gray-800 font-semibold">Jefe de Proyecto</th>
                <th className="text-center py-3 px-4 text-gray-800 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proyectosFiltrados.map((p, index) => (
                <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                  <td className="py-3 px-4 text-gray-500 text-sm">{index + 1}</td>
                  <td className="py-3 px-4 text-gray-800 font-medium">{p.nombre}</td>
                  <td className="py-3 px-4 text-gray-600 text-sm">{p.ceco}</td>
                  <td className="py-3 px-4 text-gray-600">{p.jefe || <span className="text-gray-400 italic">Sin asignar</span>}</td>
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
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear Proyecto */}
      {modalCrear && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Nuevo Proyecto</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Proyecto *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: 3900.N.F00 Nuevo Proyecto"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Centro de Costo *
              </label>
              <input
                type="text"
                value={formData.ceco}
                onChange={(e) => setFormData({ ...formData, ceco: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: Chileglobal Ventures : Proyectos Corporativos"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jefe de Proyecto
              </label>
              <input
                type="text"
                value={formData.jefe}
                onChange={(e) => setFormData({ ...formData, jefe: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Nombre del jefe de proyecto (opcional)"
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
                onClick={crearProyecto}
                className="px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#FF5100' }}
              >
                Crear Proyecto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Proyecto */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Editar Proyecto</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Proyecto *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Centro de Costo *
              </label>
              <input
                type="text"
                value={formData.ceco}
                onChange={(e) => setFormData({ ...formData, ceco: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jefe de Proyecto
              </label>
              <input
                type="text"
                value={formData.jefe}
                onChange={(e) => setFormData({ ...formData, jefe: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo del cambio *
              </label>
              <textarea
                value={motivoCambio}
                onChange={(e) => setMotivoCambio(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows={2}
                placeholder="Explica el motivo del cambio..."
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
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
