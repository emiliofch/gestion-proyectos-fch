import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'
import FilterableTh from './FilterableTh'

export default function AdministracionOC({ perfil }) {
  const [solicitudes, setSolicitudes] = useState([])
  const [_loading, setLoading] = useState(false)
  const [editando, setEditando] = useState(null)
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('fecha')
  const [ordenDir, setOrdenDir] = useState('desc')

  const empresaUsuario = perfil?.empresa || 'CGV'

  const estadosDisponibles = [
    'enviada',
    'procesada',
    'en adquisiciones',
    'ok adquisiciones',
    'finalizado flujo',
    'anulada'
  ]

  // Intencional: recarga por empresa activa.
  useEffect(() => {
    cargarTodasLasSolicitudes()
  }, [empresaUsuario])

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

  async function cargarTodasLasSolicitudes() {
    setLoading(true)
    const { data } = await supabase
      .from('solicitudes_oc')
      .select('*, proyectos(nombre)')
      .eq('empresa', empresaUsuario)
      .order('fecha_creacion', { ascending: false })

    setSolicitudes(data || [])
    setLoading(false)
  }

  async function actualizarSolicitud(id, campo, valor) {
    const { data, error } = await supabase
      .from('solicitudes_oc')
      .update({ [campo]: valor })
      .eq('id', id)
      .select()

    if (error) {
      console.error('Error actualizando solicitud:', error)
      toast.error('Error al actualizar: ' + error.message)
    } else if (!data || data.length === 0) {
      console.error('No se actualizó ningún registro - posible problema de RLS')
      toast.error('No se pudo actualizar. Verifica permisos.')
    } else {
      toast.success('Solicitud actualizada')
      cargarTodasLasSolicitudes()
      setEditando(null)
    }
  }

  function formatearValor(val) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(val)
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

  function coincideFiltros(s, omitirCol = null) {
    const matchAutor = omitirCol === 'autor' || !filtros.autor?.length || filtros.autor.includes(s.usuario_email)
    const matchProveedor = omitirCol === 'proveedor' || !filtros.proveedor?.length || filtros.proveedor.includes(s.proveedor)
    const matchProyecto = omitirCol === 'proyecto' || !filtros.proyecto?.length || filtros.proyecto.includes(s.proyecto_nombre)
    const matchEstado = omitirCol === 'estado' || !filtros.estado?.length || filtros.estado.includes(s.estado)
    return matchAutor && matchProveedor && matchProyecto && matchEstado
  }

  function opcionesPorColumna(col, obtenerValor) {
    const visibles = solicitudes.filter((s) => coincideFiltros(s, col))
    const base = visibles.map(obtenerValor).filter(Boolean)
    const seleccionadas = Array.isArray(filtros[col]) ? filtros[col] : []
    return [...new Set([...base, ...seleccionadas])].sort((a, b) => String(a).localeCompare(String(b), 'es'))
  }

  const opcionesAutor = opcionesPorColumna('autor', (s) => s.usuario_email)
  const opcionesProveedor = opcionesPorColumna('proveedor', (s) => s.proveedor)
  const opcionesProyecto = opcionesPorColumna('proyecto', (s) => s.proyecto_nombre)
  const opcionesEstado = opcionesPorColumna('estado', (s) => s.estado)

  const solicitudesFiltradas = solicitudes.filter((s) => coincideFiltros(s)).sort((a, b) => {
    let vA = ''
    let vB = ''
    if (ordenCol === 'autor') { vA = a.usuario_email || ''; vB = b.usuario_email || '' }
    if (ordenCol === 'id') { vA = Number(a.id_correlativo) || 0; vB = Number(b.id_correlativo) || 0 }
    if (ordenCol === 'proveedor') { vA = a.proveedor || ''; vB = b.proveedor || '' }
    if (ordenCol === 'glosa') { vA = a.glosa || ''; vB = b.glosa || '' }
    if (ordenCol === 'subproyecto') { vA = a.subproyecto || ''; vB = b.subproyecto || '' }
    if (ordenCol === 'proyecto') { vA = a.proyecto_nombre || ''; vB = b.proyecto_nombre || '' }
    if (ordenCol === 'valor') { vA = Number(a.valor) || 0; vB = Number(b.valor) || 0 }
    if (ordenCol === 'fecha') { vA = new Date(a.fecha_creacion).getTime() || 0; vB = new Date(b.fecha_creacion).getTime() || 0 }
    if (ordenCol === 'netsuite') { vA = a.sol_netsuite || ''; vB = b.sol_netsuite || '' }
    if (ordenCol === 'estado') { vA = a.estado || ''; vB = b.estado || '' }
    if (typeof vA === 'string') return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
    return ordenDir === 'asc' ? vA - vB : vB - vA
  })

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <div className="mb-6 flex-shrink-0">
        <h2 className="text-2xl font-bold text-gray-800" style={{ color: '#FF5100' }}>
          Administracion de OC - {empresaUsuario === 'HUB_MET' ? 'HUB MET' : 'CGV'}
        </h2>
      </div>

      {solicitudes.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No hay solicitudes OC registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <FilterableTh
                    col="autor"
                    label="Autor"
                    style={{ width: '170px' }}
                    opciones={opcionesAutor}
                    filtro={filtros.autor || ''}
                    onFiltro={setFiltro}
                    dropdownAbierto={dropdownFiltro === 'autor'}
                    onToggleDropdown={setDropdownFiltro}
                    sortable
                    ordenActiva={ordenCol === 'autor'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="id"
                    label="ID"
                    style={{ width: '88px' }}
                    opciones={[]}
                    filtro={[]}
                    onFiltro={() => {}}
                    dropdownAbierto={false}
                    onToggleDropdown={() => {}}
                    sortable
                    ordenActiva={ordenCol === 'id'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="proveedor"
                    label="Proveedor"
                    style={{ width: '180px' }}
                    opciones={opcionesProveedor}
                    filtro={filtros.proveedor || ''}
                    onFiltro={setFiltro}
                    dropdownAbierto={dropdownFiltro === 'proveedor'}
                    onToggleDropdown={setDropdownFiltro}
                    sortable
                    ordenActiva={ordenCol === 'proveedor'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="glosa"
                    label="Glosa"
                    style={{ width: '220px' }}
                    opciones={[]}
                    filtro={[]}
                    onFiltro={() => {}}
                    dropdownAbierto={false}
                    onToggleDropdown={() => {}}
                    sortable
                    ordenActiva={ordenCol === 'glosa'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="subproyecto"
                    label="Subproyecto"
                    style={{ width: '160px' }}
                    opciones={[]}
                    filtro={[]}
                    onFiltro={() => {}}
                    dropdownAbierto={false}
                    onToggleDropdown={() => {}}
                    sortable
                    ordenActiva={ordenCol === 'subproyecto'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="proyecto"
                    label="Proyecto"
                    style={{ width: '200px' }}
                    opciones={opcionesProyecto}
                    filtro={filtros.proyecto || ''}
                    onFiltro={setFiltro}
                    dropdownAbierto={dropdownFiltro === 'proyecto'}
                    onToggleDropdown={setDropdownFiltro}
                    sortable
                    ordenActiva={ordenCol === 'proyecto'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="valor"
                    label="Valor"
                    style={{ width: '125px' }}
                    opciones={[]}
                    filtro={[]}
                    onFiltro={() => {}}
                    dropdownAbierto={false}
                    onToggleDropdown={() => {}}
                    sortable
                    ordenActiva={ordenCol === 'valor'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="fecha"
                    label="Fecha"
                    style={{ width: '115px' }}
                    opciones={[]}
                    filtro={[]}
                    onFiltro={() => {}}
                    dropdownAbierto={false}
                    onToggleDropdown={() => {}}
                    sortable
                    ordenActiva={ordenCol === 'fecha'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="netsuite"
                    label="Sol. NetSuite"
                    style={{ width: '130px' }}
                    opciones={[]}
                    filtro={[]}
                    onFiltro={() => {}}
                    dropdownAbierto={false}
                    onToggleDropdown={() => {}}
                    sortable
                    ordenActiva={ordenCol === 'netsuite'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="estado"
                    label="Estado"
                    style={{ width: '170px' }}
                    opciones={opcionesEstado}
                    filtro={filtros.estado || ''}
                    onFiltro={setFiltro}
                    dropdownAbierto={dropdownFiltro === 'estado'}
                    onToggleDropdown={setDropdownFiltro}
                    sortable
                    ordenActiva={ordenCol === 'estado'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                </tr>
              </thead>
              <tbody>
                {solicitudesFiltradas.map((s) => (
                  <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.usuario_email}</td>
                    <td className="py-3 px-4 text-gray-800 font-medium">{s.id_correlativo || '-'}</td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.proveedor}</td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.glosa}</td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.subproyecto || '-'}</td>
                    <td className="py-3 px-4 text-gray-800 text-sm">{s.proyecto_nombre}</td>
                    <td className="py-3 px-4 text-gray-800 font-semibold text-sm">
                      {formatearValor(s.valor)}
                    </td>
                    <td className="py-3 px-4 text-gray-800 text-sm">
                      {new Date(s.fecha_creacion).toLocaleDateString('es-CL')}
                    </td>

                    {/* Sol. NetSuite - Editable */}
                    <td className="py-3 px-4">
                      {editando === `${s.id}-netsuite` ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            defaultValue={s.sol_netsuite || ''}
                            onBlur={(e) => actualizarSolicitud(s.id, 'sol_netsuite', e.target.value || null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                actualizarSolicitud(s.id, 'sol_netsuite', e.target.value || null)
                              }
                              if (e.key === 'Escape') {
                                setEditando(null)
                              }
                            }}
                            autoFocus
                            className="w-32 px-2 py-1 border border-orange-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditando(`${s.id}-netsuite`)}
                          className="text-sm text-gray-800 hover:text-orange-600 underline"
                        >
                          {s.sol_netsuite || 'Agregar'}
                        </button>
                      )}
                    </td>

                    {/* Estado - Editable con dropdown */}
                    <td className="py-3 px-4">
                      <select
                        value={s.estado}
                        onChange={(e) => actualizarSolicitud(s.id, 'estado', e.target.value)}
                        className="px-3 py-1 rounded-full text-xs font-medium border-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
                        style={{
                          borderColor:
                            s.estado === 'enviada' ? '#3B82F6' :
                            s.estado === 'procesada' ? '#A855F7' :
                            s.estado === 'en adquisiciones' ? '#EAB308' :
                            s.estado === 'ok adquisiciones' ? '#10B981' :
                            s.estado === 'finalizado flujo' ? '#059669' :
                            s.estado === 'anulada' ? '#EF4444' :
                            '#6B7280',
                          backgroundColor:
                            s.estado === 'enviada' ? '#DBEAFE' :
                            s.estado === 'procesada' ? '#F3E8FF' :
                            s.estado === 'en adquisiciones' ? '#FEF3C7' :
                            s.estado === 'ok adquisiciones' ? '#D1FAE5' :
                            s.estado === 'finalizado flujo' ? '#D1FAE5' :
                            s.estado === 'anulada' ? '#FEE2E2' :
                            '#F3F4F6',
                          color:
                            s.estado === 'enviada' ? '#1E40AF' :
                            s.estado === 'procesada' ? '#7C3AED' :
                            s.estado === 'en adquisiciones' ? '#A16207' :
                            s.estado === 'ok adquisiciones' ? '#047857' :
                            s.estado === 'finalizado flujo' ? '#047857' :
                            s.estado === 'anulada' ? '#B91C1C' :
                            '#374151'
                        }}
                      >
                        {estadosDisponibles.map(estado => (
                          <option key={estado} value={estado}>{estado}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Total de solicitudes: <span className="font-semibold">{solicitudesFiltradas.length}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

