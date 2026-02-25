import { useEffect, useState } from 'react'
import FilterableTh from './FilterableTh'

function fmtVal(v) {
  if (v === null || v === undefined || v === '') return '-'
  const n = parseFloat(v)
  return isNaN(n) ? v : n.toFixed(1)
}

export default function VistaControlCambios({ cambiosFiltrados, tipoControlCambios, setTipoControlCambios }) {
  const [filtros, setFiltros] = useState({})
  const [dropdownFiltro, setDropdownFiltro] = useState(null)
  const [ordenCol, setOrdenCol] = useState('fecha')
  const [ordenDir, setOrdenDir] = useState('desc')

  useEffect(() => {
    if (!dropdownFiltro) return
    function cerrar() { setDropdownFiltro(null) }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [dropdownFiltro])

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

  const opcionesProyecto = [...new Set(cambiosFiltrados.map((c) => c.proyecto_nombre).filter(Boolean))].sort()
  const opcionesCampo = [...new Set(cambiosFiltrados.map((c) => c.campo).filter(Boolean))].sort()
  const opcionesUsuario = [...new Set(cambiosFiltrados.map((c) => c.usuario).filter(Boolean))].sort()

  const cambiosConFiltros = cambiosFiltrados.filter((c) => {
    const matchProyecto = !filtros.proyecto?.length || filtros.proyecto.includes(c.proyecto_nombre)
    const matchCampo = !filtros.campo?.length || filtros.campo.includes(c.campo)
    const matchUsuario = !filtros.usuario?.length || filtros.usuario.includes(c.usuario)
    return matchProyecto && matchCampo && matchUsuario
  }).sort((a, b) => {
    let vA = ''
    let vB = ''
    if (ordenCol === 'proyecto') { vA = a.proyecto_nombre || ''; vB = b.proyecto_nombre || '' }
    if (ordenCol === 'fecha') { vA = new Date(a.fecha).getTime() || 0; vB = new Date(b.fecha).getTime() || 0 }
    if (ordenCol === 'campo') { vA = a.campo || ''; vB = b.campo || '' }
    if (ordenCol === 'anterior') { vA = parseFloat(a.valor_anterior) || 0; vB = parseFloat(b.valor_anterior) || 0 }
    if (ordenCol === 'nuevo') { vA = parseFloat(a.valor_nuevo) || 0; vB = parseFloat(b.valor_nuevo) || 0 }
    if (ordenCol === 'usuario') { vA = a.usuario || ''; vB = b.usuario || '' }
    if (ordenCol === 'motivo') { vA = a.motivo || ''; vB = b.motivo || '' }
    if (typeof vA === 'string') return ordenDir === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es')
    return ordenDir === 'asc' ? vA - vB : vB - vA
  })

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <div className="flex justify-between items-center flex-shrink-0 pb-3">
        <h2 className="text-2xl font-bold text-gray-800">Control de Cambios</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTipoControlCambios('valor')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${tipoControlCambios === 'valor' ? 'text-white' : 'bg-gray-200 text-gray-800'}`}
            style={{ backgroundColor: tipoControlCambios === 'valor' ? '#FF5100' : '' }}
            title="Ver cambios de valores numéricos"
          >
            Cambios de Valores
          </button>
          <button
            onClick={() => setTipoControlCambios('proyecto')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${tipoControlCambios === 'proyecto' ? 'text-white' : 'bg-gray-200 text-gray-800'}`}
            style={{ backgroundColor: tipoControlCambios === 'proyecto' ? '#FF5100' : '' }}
            title="Ver creación/eliminación de proyectos"
          >
            Cambios de Proyectos
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="border-b-2 border-gray-300" style={{ backgroundColor: '#FFF5F0', position: 'sticky', top: 0, zIndex: 10 }}>
              {tipoControlCambios === 'valor' && (
                <FilterableTh
                  col="proyecto"
                  label="Proyecto"
                  style={{ width: '160px' }}
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
              )}
              <FilterableTh
                col="fecha"
                label="Fecha"
                style={{ width: '150px' }}
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
                col="campo"
                label="Campo"
                style={{ width: '130px' }}
                opciones={opcionesCampo}
                filtro={filtros.campo || ''}
                onFiltro={setFiltro}
                dropdownAbierto={dropdownFiltro === 'campo'}
                onToggleDropdown={setDropdownFiltro}
                sortable
                ordenActiva={ordenCol === 'campo'}
                ordenDir={ordenDir}
                onOrdenar={toggleOrden}
              />
              {tipoControlCambios === 'valor' && (
                <>
                  <FilterableTh
                    col="anterior"
                    label="Anterior"
                    style={{ width: '110px' }}
                    opciones={[]}
                    filtro={[]}
                    onFiltro={() => {}}
                    dropdownAbierto={false}
                    onToggleDropdown={() => {}}
                    sortable
                    ordenActiva={ordenCol === 'anterior'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                  <FilterableTh
                    col="nuevo"
                    label="Nuevo"
                    style={{ width: '110px' }}
                    opciones={[]}
                    filtro={[]}
                    onFiltro={() => {}}
                    dropdownAbierto={false}
                    onToggleDropdown={() => {}}
                    sortable
                    ordenActiva={ordenCol === 'nuevo'}
                    ordenDir={ordenDir}
                    onOrdenar={toggleOrden}
                  />
                </>
              )}
              <FilterableTh
                col="usuario"
                label="Usuario"
                style={{ width: '160px' }}
                opciones={opcionesUsuario}
                filtro={filtros.usuario || ''}
                onFiltro={setFiltro}
                dropdownAbierto={dropdownFiltro === 'usuario'}
                onToggleDropdown={setDropdownFiltro}
                sortable
                ordenActiva={ordenCol === 'usuario'}
                ordenDir={ordenDir}
                onOrdenar={toggleOrden}
              />
              <FilterableTh
                col="motivo"
                label="Motivo"
                opciones={[]}
                filtro={[]}
                onFiltro={() => {}}
                dropdownAbierto={false}
                onToggleDropdown={() => {}}
                sortable
                ordenActiva={ordenCol === 'motivo'}
                ordenDir={ordenDir}
                onOrdenar={toggleOrden}
              />
            </tr>
          </thead>
          <tbody>
            {cambiosConFiltros.map(c => (
              <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50 transition-all">
                {tipoControlCambios === 'valor' && (
                  <td className="py-3 px-4 text-gray-800 font-medium">{c.proyecto_nombre || 'N/A'}</td>
                )}
                <td className="py-3 px-4 text-gray-800 text-sm">{new Date(c.fecha).toLocaleString()}</td>
                <td className="py-3 px-4 text-gray-800">{c.campo}</td>
                {tipoControlCambios === 'valor' && (
                  <>
                    <td className="py-3 px-4 text-gray-800">{fmtVal(c.valor_anterior)}</td>
                    <td className="py-3 px-4 text-gray-800">{fmtVal(c.valor_nuevo)}</td>
                  </>
                )}
                <td className="py-3 px-4 text-gray-800">{c.usuario}</td>
                <td className="py-3 px-4 text-gray-800">{c.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
